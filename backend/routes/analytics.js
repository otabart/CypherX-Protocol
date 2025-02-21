const express = require('express');
const router = express.Router();

// Example route for analytics
router.get('/', (req, res) => {
  res.json({ message: 'Analytics data here' });
});

module.exports = router;
