import { NextFunction, Request, Response } from 'express';

const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
	
	if (err && !res.headersSent) {
		res.send({ Title: 'Error', Message: err.message });
	}
    console.error(err)
};
export default errorHandler;
