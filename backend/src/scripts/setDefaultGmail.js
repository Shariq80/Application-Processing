require('dotenv').config();
const mongoose = require('mongoose');
const OAuthCredential = require('../models/OAuthCredential');

async function setDefaultGmail() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find the existing credential and set it as default
    const existingCred = await OAuthCredential.findOne({
      _id: '6730b0828657132011a71de8'  // ID of your existing credential
    });

    if (!existingCred) {
      console.error('Existing credential not found');
      return;
    }

    existingCred.isDefault = true;
    await existingCred.save();

    console.log('Default Gmail account set successfully');
  } catch (error) {
    console.error('Error setting default Gmail:', error);
  } finally {
    mongoose.connection.close();
  }
}

setDefaultGmail(); 