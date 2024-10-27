const Job = require('../models/Job');
const Application = require('../models/Application');  // Add this import
const mongoose = require('mongoose');

exports.createJob = async (req, res) => {
  try {
    const { title, description } = req.body;
    const job = new Job({
      title,
      description,
      createdBy: req.user._id
    });
    await job.save();
    res.status(201).json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ createdBy: req.user._id });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getJob = async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateJob = async (req, res) => {
  try {
    const { title, description, status } = req.body;
    const job = await Job.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      { title, description, status },
      { new: true }
    );
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteJob = async (req, res) => {
  try {
    const { id } = req.params;
    const { deleteApplications } = req.query;
    
    console.log('Deleting job:', id, 'with applications:', deleteApplications);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const deletedJob = await Job.findByIdAndDelete(id).session(session);
      console.log('Deleted job:', deletedJob);
      
      if (!deletedJob) {
        throw new Error('Job not found');
      }

      if (deleteApplications === 'true') {
        const result = await Application.deleteMany({ job: id }).session(session);
        console.log('Deleted applications:', result);
      }

      await session.commitTransaction();
      session.endSession();

      res.json({ message: 'Job deleted successfully' });
    } catch (error) {
      console.error('Transaction error:', error);
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: error.message });
  }
};
