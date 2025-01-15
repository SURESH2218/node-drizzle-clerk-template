class APIErrorResponse extends Error {
  statusCode: number;
  data: any | null;
  message: string;
  success: boolean;
  errors: any[];

  constructor(
    statusCode: number,
    message: string = "Please Try Again!",
    errors: any[] = [],
    stack: string = ""
  ) {
    super(message);
    this.statusCode = statusCode;
    this.data = null;
    this.message = message;
    this.success = false;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default APIErrorResponse;
