require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const User = require('../models/User');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const name = await question('Enter admin name: ');
    const email = await question('Enter admin email: ');
    const password = await question('Enter admin password: ');

    const admin = new User({
      name,
      email,
      password,
      role: 'admin'
    });

    await admin.save();
    console.log('Admin user created successfully!');
    
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    rl.close();
    mongoose.connection.close();
  }
}

createAdmin();
