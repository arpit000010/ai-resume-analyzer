const roles = require("../data/roles.json");

const detectRole = (jdText) => {
  jdText = jdText.toLowerCase();

  for (const role in roles) {
    if (jdText.includes(role)) {
      return role;
    }
  }
  return null;
};

module.exports = detectRole;
