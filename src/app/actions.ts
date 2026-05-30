// Client-side cache revalidation mocks for static export.
// Server Actions / revalidatePath are not supported in static exports, so these are no-ops.

export async function revalidateBuilding(buildingId: string) {
  // no-op
}
 
export async function revalidateAll() {
  // no-op
}
