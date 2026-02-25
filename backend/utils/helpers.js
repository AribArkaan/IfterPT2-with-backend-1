// Common helper functions

function handleError(res, error, message = 'Internal server error') {
  console.error(`❌ ${message}:`, error);
  res.status(500).json({
    success: false,
    error: message,
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
}

function handleSuccess(res, data, message = 'Success') {
  res.json({
    success: true,
    message,
    data
  });
}

function checkIfRamadhan() {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  if (month === 3) {
    return true;
  }

  return false;
}

module.exports = {
  handleError,
  handleSuccess,
  checkIfRamadhan
};
