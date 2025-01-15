import { Request, Response, NextFunction } from "express";
import APIErrorResponse from "../lib/APIErrorResponse.js";

const developmentErrors = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  err.stack = err.stack || "";
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message,
      stack: err.stack,
      ...(err.errors && { errors: err.errors }),
    },
  });
};

const productionErrors = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: err.message,
    ...(err.errors && { errors: err.errors }),
  });
};

const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new APIErrorResponse(404, `Route ${req.originalUrl} not found`);
  next(error);
};

const handleErrors = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (process.env.NODE_ENV === "production") {
    productionErrors(err, req, res, next);
  } else {
    developmentErrors(err, req, res, next);
  }
};

export { developmentErrors, productionErrors, notFound, handleErrors };
