import { Request, Response} from 'express';
import { Users, IUser } from '../models/users';
import bcrypt from 'bcrypt';
import { getAccessToken, handleError } from '../helpers';

export const signup = async (req: Request, res: Response): Promise<void> => {
    try {
        const name: string = req.body.name;
        const email: string = req.body.email;
        const password: string = req.body.password;
    
        if (!name || !email || !password) {
            return handleError(res, 400, 'All Fields are Mandatory')
        }

        if (await Users.findOne({where: { email }})) {
            return handleError(res, 400, 'User Already Exists. Login Instead')
        } else {
            const hashedPassword = await bcrypt.hash(password, 10);
            const result = { name, email, password: hashedPassword };
            const user = await Users.create(result);
            
            if (user) {
                res.status(201).send({ token: getAccessToken({name: user.name, email: user.email, id: user.id}) });
                return;
            } else {
                return handleError(res, 400, 'Invalid Data sent during signup process')
            }
        }
    } catch (err) {
        console.error(err)
        return handleError(res, 500, `${err}`)
    }
}

export const login = async (req: Request, res: Response): Promise<void> => {
	const email: string = req.body.email;
	const password: string = req.body.password;

	if (!email || !password) {
        return handleError(res, 400, 'All Fields are Mandatory')
	}
	const user: IUser | null = await Users.findOne({ email });    

	if (user) {
		const hashedPassword: string = user.password;

		if (await bcrypt.compare(password, hashedPassword)) {
            const accessToken = getAccessToken({name: user.name, email: user.email, id: user.id})
			res.status(200).send({ token: accessToken });
            return;
		}
	} else {
        return handleError(res, 401, 'Email or Password is invalid')
	}
};
