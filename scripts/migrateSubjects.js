const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Subject = require('../models/Subject');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    await Subject.deleteMany({});
    console.log('Cleared existing Subjects');

    const subjectsPath = path.join(__dirname, '..', 'subjects.json');
    if (!fs.existsSync(subjectsPath)) {
      console.log('No subjects.json found, skipping.');
      return;
    }

    const data = fs.readFileSync(subjectsPath, 'utf8');
    const subjects = JSON.parse(data || '[]');

    let added = 0;
    for (const sub of subjects) {
      await Subject.create({
        year: sub.year,
        semester: sub.semester,
        subjectName: sub.subjectName,
        subjectCode: sub.subjectCode
      });
      added++;
    }

    console.log(`Successfully migrated ${added} subjects to MongoDB.`);
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    mongoose.disconnect();
  }
}

migrate();
