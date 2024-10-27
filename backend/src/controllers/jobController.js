const Job = require('../models/Job');

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
    const job = await Job.findOneAndDelete({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};