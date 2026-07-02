/**
 * Request validation middleware generator
 * Checks query, body, or parameter keys to enforce strict API contracts.
 */
function validateRequest({ query = [], body = [], params = [] } = {}) {
  return (req, res, next) => {
    const missing = [];

    // Check query params
    query.forEach(key => {
      if (!req.query || req.query[key] === undefined) {
        missing.push({ location: 'query', parameter: key });
      }
    });

    // Check body params
    body.forEach(key => {
      if (!req.body || req.body[key] === undefined) {
        missing.push({ location: 'body', parameter: key });
      }
    });

    // Check path params
    params.forEach(key => {
      if (!req.params || req.params[key] === undefined) {
        missing.push({ location: 'params', parameter: key });
      }
    });

    if (missing.length > 0) {
      const err = new Error(`Request Validation Failed: Missing fields`);
      err.status = 400;
      err.validationErrors = missing;
      return next(err);
    }

    next();
  };
}

module.exports = {
  validateRequest
};
