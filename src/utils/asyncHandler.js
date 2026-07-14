/**
 *  asyncHandler is for the common case where any
 * thrown/rejected error should just go to the global error handler.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export { asyncHandler };
