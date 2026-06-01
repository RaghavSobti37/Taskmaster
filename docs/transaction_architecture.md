# Transaction Architecture & Concurrency Handling

## Root Cause Analysis
The error **"Write conflict during plan execution and yielding is disabled. :: Please retry your operation or multi-document transaction"** is a native MongoDB error (Error Code 112 or `WriteConflict`). It occurs when two concurrent operations attempt to modify the same document simultaneously within a multi-document transaction. 

### Why It Happened:
Previously, the backend used a manual transaction lifecycle:
```javascript
const session = await mongoose.startSession();
session.startTransaction();
try {
  // operations
  await session.commitTransaction();
} catch(err) {
  await session.abortTransaction();
} finally {
  session.endSession();
}
```
If a `WriteConflict` or `TransientTransactionError` occurred in MongoDB, the manual block immediately caught the error, aborted the transaction, and threw it to the client (yielding the 500 error). It lacked an automatic backoff and retry loop. 

## The Fix
The logic has been migrated to use Mongoose's `session.withTransaction()` helper in both `taskController.js` and `notificationService.js`.

```javascript
const session = await mongoose.startSession();
try {
  await session.withTransaction(async () => {
    // operations
  });
} finally {
  session.endSession();
}
```

### Why `withTransaction()` works:
1. **Auto-Retry Loop:** It automatically catches `TransientTransactionError` and `UnknownTransactionCommitResult` and retries the entire callback logic.
2. **Idempotency:** The callback provided to `withTransaction()` can be safely re-run multiple times if a write conflict occurs.
3. **Yielding:** It seamlessly handles yielding locks and waiting for concurrent writes to finish.

## In-Depth Architecture: How Transactions Work Currently

### 1. Scope and Modules
Transactions are strictly enforced around operations that mutate multiple related documents to preserve **ACID (Atomicity, Consistency, Isolation, Durability)** properties. 
Currently, transactions are concentrated in:
- **`taskController.js`**: `createTask`, `updateTask`, `deleteTask`, and `reportBug`.
- **`notificationService.js`**: `checkOverdue` CRON job.
- **`TaskService.js`**: Reuses the active `session` passed from controllers.

### 2. Multi-Document Interdependencies
A single task creation or update involves multiple collections. Transactions ensure that if one write fails, all rollback.
- **`Tasks`**: The primary document.
- **`TaskAssignments`**: Mapping documents for assigned users. If a task fails to create, assignments are discarded.
- **`Projects`**: Rolling up counters (e.g., `totalTasksCount`, `completedTasksCount`).
- **`Logs`**: System-generated user activity logs.
- **`Users` / `Leads`**: References and follow-up markers.

### 3. The Controller-Service Handoff
Controllers initiate the `session`, manage the transaction scope, and handle HTTP responses.
Services (`TaskService.js`) receive the `session` object as a parameter.
```javascript
// Example from taskController.js
await session.withTransaction(async () => {
    taskDto = await TaskService.updateTask(req.params.id, updates, req.user, session);
});
```
Within `TaskService.js`, every Mongoose operation that modifies data explicitly includes the session:
```javascript
await Task.findByIdAndUpdate(taskId, updates, { session });
await TaskAssignment.insertMany(assignments, { session });
await Project.findByIdAndUpdate(projectId, { $inc: { totalTasksCount: 1 } }, { session });
```

### 4. Background Job Transactions
The `notificationService.js` CRON job `checkOverdue` runs every minute. It identifies overdue tasks and leads, updates their `notifiedOverdue` boolean to `true`, and queues notifications.
Because this job scans and updates multiple collections asynchronously, it is wrapped in a transaction to prevent partial updates in the event of a crash or race condition with a user manually updating the same task.

### 5. Locking and Concurrency
- **Redis Locks**: While MongoDB handles document-level locking via transactions, Redis locks (`notification-lock:overdue`) handle process-level locking to prevent multiple server instances from running the same CRON job concurrently.
- **Optimistic Concurrency**: Mongoose `__v` (version key) works alongside transactions to prevent lost updates. However, to avoid version-locking bottlenecks, raw atomic operators are preferred over `.save()` when mutating arrays or boolean flags.

### 6. Edge Cases Handled
- **Dynamic Project Member Syncing**: During `reportBug`, the system checks if the user is in the `Tech Stack & Maintenance` project. If not, it adds them. This sync happens inside the transaction via atomic updates (`findByIdAndUpdate`), avoiding race conditions where two users report bugs concurrently and both try to update the `members` array.
- **Notification Deferral**: Creating external notifications (or realtime socket emits) happens **after** the transaction commits successfully. This prevents sending an email/socket event for a transaction that subsequently rolls back.

---

## CRITICAL: Mandatory Operational Rules

> **Mandatory Rule:** All code blocks encapsulated inside `session.withTransaction()` must be entirely idempotent. No external API dispatches, no un-memoized array pushes to variables out-of-scope, and all array additions must utilize raw atomic MongoDB operators (`$addToSet`, `$inc`, `$set`) instead of instance-level `.save()` calls to prevent version-locking bottlenecks.

### Architectural Blind Spots to Avoid
1. **The Callback Idempotency Trap**: `session.withTransaction()` retries its callback upon `TransientTransactionError`. Any variable mutated in memory (like `array.push()`) inside this block will run twice if a retry happens, causing duplicates. **Always re-initialize arrays/variables inside the block or use pure functions.**
2. **In-Transaction Microservices**: Never perform external API calls, file parsing, or heavy synchronous operations inside the transaction. Transactions must be extremely fast to avoid holding database locks and increasing the probability of a `WriteConflict`.
3. **Mongoose `__v` Version Key Conflict**: Avoid using `doc.save()` inside high-concurrency transactions, as it increments `__v` and will trigger a `VersionError` if another transaction touches the same document. Use atomic updates like `findByIdAndUpdate` with `$addToSet` instead.
4. **CRON Job Query Optimization**: Background job scans inside a transaction (like looking for `notifiedOverdue: false`) must hit a strict compound index (e.g., `TaskSchema.index({ status: 1, dueDate: 1, notifiedOverdue: 1 })`). Without an index, MongoDB escalates to collection-level locks during the scan, freezing the entire application.
