import { formatDateKeyIST } from '../../utils/attendanceUtils';

const rowUserId = (row) => String(row?.userId?._id || row?.userId || '');

const rowDateKey = (row) => {
  if (!row?.date) return '';
  return formatDateKeyIST(new Date(row.date));
};

/** Merge a single attendance row into cached list responses (month + daily queries). */
export const upsertAttendanceRowInList = (rows, updatedRow) => {
  if (!Array.isArray(rows) || !updatedRow) return rows;
  const updatedKey = rowDateKey(updatedRow);
  const updatedUserId = rowUserId(updatedRow);
  let found = false;
  const next = rows.map((row) => {
    if (rowDateKey(row) === updatedKey && rowUserId(row) === updatedUserId) {
      found = true;
      return updatedRow;
    }
    return row;
  });
  return found ? next : [updatedRow, ...next];
};

export const patchAttendanceQueries = (queryClient, updatedRow) => {
  if (!updatedRow) return;
  queryClient.setQueriesData({ queryKey: ['attendance'] }, (old) =>
    upsertAttendanceRowInList(old, updatedRow)
  );
};
