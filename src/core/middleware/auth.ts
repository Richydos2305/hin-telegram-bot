import {verify, Secret} from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { settings } from '../config/application';
import { handleError } from '../helpers/index';
import { Types } from 'mongoose';

export interface UserPayload {
	userDetails: {
		username: string;
		email: string;
		id: Types.ObjectId;
	};
}

export const auth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	let token: string | undefined = req.header('Authorization');
    const prefix = 'Bearer ';
	if (!token) {
        handleError(res, 401, 'Unauthorized');
	} else if (token.startsWith(prefix)) {
        token = token.slice(prefix.length);
		try {
			const payload = verify(token, settings.secretKey as Secret) as UserPayload;

			res.locals = payload;
			next();
		} catch (error) {
            console.error(error)
			next(error);
            handleError(res, 401, 'Unauthorized');
		}
	}
};
