import { Response } from 'express';
import { settings } from '../config/application';
import { sign } from 'jsonwebtoken';
import { Users } from '../models/users';
import { Types } from 'mongoose';

export function handleError(res: Response, statusCode: number, message: string): void {
  res.status(statusCode).send({ message });
}

export function getAccessToken(user: {name: string, email: string, id: Types.ObjectId}): string {

  const accessToken = sign(
    {
      userDetails: {
        name: user.name,
        email: user.email,
        id: user.id
      }
    },
    settings.secretKey,
    { expiresIn: '4h' }
  );
  return accessToken
}

export async function userExists(loggedInUserId: Types.ObjectId ): Promise<boolean> {
  const loggedInUser = await Users.findById(loggedInUserId)
  if (loggedInUser)
    return true
  return false
}
