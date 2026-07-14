/**
 * Shared validation patterns.
 *
 * Previously the phone and email regexes were each defined separately in
 * middlewares/validator.js, utils/validators.js, models/User.js, and
 * models/TrustedContact.js — four copies that could silently drift apart.
 * Import from here instead of re-declaring a pattern.
 */
const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export { PHONE_REGEX, EMAIL_REGEX };
