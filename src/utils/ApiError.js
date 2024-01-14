class ApiError extends Error {         // Define a class named ApiError that extends the built-in Error class
    // Constructor function with parameters: statusCode, message (default: "Something went wrong"), errors (default: an empty array), stack (default: an empty string)
    constructor(statusCode, message = "Something went wrong", errors = [], statck = "") {
        super(message)                 // Call the constructor of the Error class with the provided message
        this.statusCode = statusCode   // Assign the provided statusCode to the class property "statusCode"
        this.data = null               // Set the initial value of the "data" property to null
        this.message = message         // Assign the provided message to the class property "message"
        this.success = false           // Set the initial value of the "success" property to false (since it's an error)
        this.errors = errors           // Assign the provided errors to the class property "errors"

        if(statck) {                   // Check if a custom stack is provided; if yes, assign it to the "stack" property. Otherwise, capture the stack trace.
            this.stack = statck
        } else {
            // If no custom stack is provided, capture the stack trace using Error.captureStackTrace method
            Error.captureStackTrace(this, this.constructor)
        }
    }
};

export { ApiError };