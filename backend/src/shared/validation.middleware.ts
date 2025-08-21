import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import Joi from 'joi';
import { ApiResponse } from './types';

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: {
            errors: validationErrors
          }
        }
      };

      res.status(400).json(response);
      return;
    }

    // Replace request body with validated and sanitized data
    req.body = value;
    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query validation failed',
          details: {
            errors: validationErrors
          }
        }
      };

      res.status(400).json(response);
      return;
    }

    // Replace request query with validated and sanitized data
    req.query = value;
    next();
  };
};

export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Parameter validation failed',
          details: {
            errors: validationErrors
          }
        }
      };

      res.status(400).json(response);
      return;
    }

    // Replace request params with validated and sanitized data
    req.params = value;
    next();
  };
};

// Express-validator middleware
export const validationMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map(error => ({
      field: error.type === 'field' ? (error as any).path : error.type,
      message: error.msg,
      value: (error as any).value
    }));

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: {
          errors: validationErrors
        }
      }
    };

    res.status(400).json(response);
    return;
  }

  next();
};