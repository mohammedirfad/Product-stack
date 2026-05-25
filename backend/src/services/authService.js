import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export class AuthService {
  constructor({ userRepository, jwtConfig }) {
    this.userRepository = userRepository;
    this.jwtConfig = jwtConfig;
  }

  async login({ email, password }) {
    const user = this.userRepository.findByEmail(email);
    if (!user || !(await bcrypt.compare(String(password || ''), user.passwordHash))) {
      return null;
    }

    const publicUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };

    const token = jwt.sign(publicUser, this.jwtConfig.secret, {
      issuer: this.jwtConfig.issuer,
      expiresIn: this.jwtConfig.expiresIn,
      subject: user.id
    });

    return {
      token,
      tokenType: 'Bearer',
      expiresIn: this.jwtConfig.expiresIn,
      user: publicUser
    };
  }
}
