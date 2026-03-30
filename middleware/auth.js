import jwt from 'jsonwebtoken';
import { Admin } from '../models/index.js';

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorised. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const admin = await Admin.findById(decoded.id).select('-password');
    if (!admin) return res.status(401).json({ message: 'Admin account not found.' });

    req.admin = admin;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') return res.status(401).json({ message: 'Invalid token.' });
    if (err.name === 'TokenExpiredError') return res.status(401).json({ message: 'Token expired. Please log in again.' });
    next(err);
  }
};
