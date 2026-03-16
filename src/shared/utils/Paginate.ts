interface PaginationResult {
  skip:       number;
  limit:      number;
  page:       number;
  totalPages: (total: number) => number;
}

export const paginate = (
  query: Record<string, any>
): PaginationResult => {
  const page  = Math.max(Number(query.page)  || 1, 1);
  const limit = Math.min(Number(query.limit) || 10, 100);
  const skip  = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
    totalPages: (total: number) => Math.ceil(total / limit),
  };
};