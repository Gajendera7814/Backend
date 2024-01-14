class ApiResponse {
    constructor(statusCode, data, message = "Success") {  // Constructor function with parameters: statusCode, data, and an optional message with a default value of "Success"
        this.statusCode = statusCode;  // Assign the provided statusCode to the class property "statusCode"
        this.data = data;  // Assign the provided data to the class property "data"
        this.message = message;  // Assign the provided message (or the default "Success" if not provided) to the class property "message"
        this.success = statusCode < 400;  // Determine the success status based on the statusCode (success if statusCode is less than 400)
    }
}

export { ApiResponse };
