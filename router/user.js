const router = require("express").Router();
const { update } = require("../controllers/userController");
const { auth } = require("../middleware/auth");
const {
	rules: updateUserRules,
} = require("../validators/user/update");
const { validate } = require("../validators");
const { userFile } = require("../middleware/fileUpload");

router.post(
	"/update",
	[auth, userFile, updateUserRules, validate],
	update
);

module.exports = router;
