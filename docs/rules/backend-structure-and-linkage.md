# Backend Structure and Linkage Rules
**Status:** Immutable Architectural Specification
**Scope:** Server-side logic, Database Schema, and API Optimization

## 1. Airtight Input Sanitization Pipelines
All data mutation requests must pass through a strict structural interceptor layer.
- **Sanitization Layer**:
    - **Mongoose Hooks**: Use `schema.pre('save')` for final normalization.
    - **Identity Logic**: Auto-trim whitespace and collapse multiple inner spaces.
    - **XSS Protection**: Strip HTML/Script tags from all text inputs.
- **Formatting Constraints**:
    - **Emails**: Force `.toLowerCase()` and validate via strict regex.
    - **Phone Numbers**: Remove all non-numeric characters before storage to ensure lookup consistency.

## 2. De-duplicated Single Source of Truth
Maintain absolute data integrity across all collections.
- **Unique Identifiers**:
    - Enforce compound indexes: `LeadSchema.index({ phone: 1, email: 1 }, { unique: true });`.
- **Import Strategy (`CRM_IMPORT`)**:
    - Perform "Check-then-Write" logic. 
    - Existing records must be updated via atomic `$set` (upsert) to prevent duplication.
- **Live Aggregation**:
    - Virtual views (e.g., Follow-ups) must never hold cached or duplicated data arrays.
    - Execute live lookups using MongoDB Aggregation pipelines.

## 3. Strict Query Optimization Policy
High-performance data retrieval is non-negotiable.
- **Memory Management**: Use `.lean()` for all read-only `GET` operations to bypass Mongoose hydration.
- **Relationship Resolution**: Use `.populate()` to resolve ObjectIDs into human-readable objects (e.g., `{ name, avatar, role }`). Never expose raw hex IDs to the UI.
- **Aggregation Efficiency**: 
    - Replace multiple `countDocuments()` calls with single-pass `$facet` or `$group` stages.
    - Metric endpoints must be calculated server-side via pipelines, not client-side.

## 4. Concurrency & Traceability Protocols
- **Audit Logging**: 
    - All CRM modifications must be recorded in the `CRMAudit` collection.
    - Automatically calculate and store deltas: `{ oldValue, newValue }`.
- **Collision Prevention**:
    - Use `lockedBy` (User ID) and `lockedAt` (Timestamp) fields for active editing sessions.
    - Return `HTTP 423 Locked` if a concurrent modification attempt is detected.
