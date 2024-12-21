import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { signup, login } from '../controllers/users';

const userRouter = express.Router();

userRouter.post('/register', asyncHandler(signup));
userRouter.post('/login', asyncHandler(login));

export default userRouter;
