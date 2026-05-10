const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const config = require('./config');
const { tokenTypes } = require('./tokens');
const { query } = require('./database');

const jwtOptions = {
  secretOrKey: config.jwt.secret,
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
};

const jwtVerify = async (payload, done) => {
  try {
    if (payload.type !== tokenTypes.ACCESS) {
      throw new Error('Invalid token type');
    }
    const rows = await query(
      'SELECT user_id, full_name, username, email, mobile, gender, avatar, role, status, must_change_password FROM users WHERE user_id = ? AND status = "active"',
      [payload.sub]
    );
    if (!rows.length) {
      return done(null, false);
    }
    done(null, rows[0]);
  } catch (error) {
    done(error, false);
  }
};

const jwtStrategy = new JwtStrategy(jwtOptions, jwtVerify);

module.exports = { jwtStrategy };
