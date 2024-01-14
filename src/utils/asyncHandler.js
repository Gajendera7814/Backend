const asyncHandler = (requestHandler) => {
    // Return a function that takes request, response, and next as parameters
    (req, res, next) => {
        // Resolve the promise returned by the requestHandler and handle any potential errors
        Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err))
    }
};

export { asyncHandler };


/* <<<<----------------------------------->>> By using try-catch <<<----------------------------------->>>>

// const asyncHandler = () => {}
// const asyncHandler = (func) => () => {}
// const asyncHandler = (func) => async () => {}

const asyncHandler = (fn) => async (req, res, next) => {
    try {
        await fn(req, res, next);
    } catch (error) {
        res.status(error.code || 500).json({
            success: false,
            message: error.message
        })
    }
}
*/