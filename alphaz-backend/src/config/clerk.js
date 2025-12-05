const { Clerk } = require('@clerk/clerk-sdk-node');
require('dotenv').config();

const clerk = new Clerk({ secretKey: process.env.CLERK_SECRET_KEY });

module.exports = clerk;