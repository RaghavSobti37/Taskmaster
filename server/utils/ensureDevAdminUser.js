/**

 * Ensure known dev login accounts exist with the default seed password.

 * Skipped in production and when SKIP_DEV_ADMIN_BOOTSTRAP=true.

 */

const logger = require('./logger');

const { getDefaultSeedPassword } = require('./defaultPassword');

const { normalizePersonName } = require('./sanitizer');

const Department = require('../models/Department');

const { seedDepartments } = require('../services/departmentService');

const { ADMIN_SLUG, isAdminUser } = require('./departmentPermissions');



const DEFAULT_DEV_ACCOUNTS = [

  { email: 'dev-admin@example.com', name: 'Dev Admin' },

  { email: 'dev-owner@example.com', name: 'Dev Admin' },

];



function resolveDevAccounts() {

  const adminEmail = (process.env.ADMIN_EMAIL || 'dev-admin@example.com').trim().toLowerCase();

  const extraRaw = (process.env.DEV_BOOTSTRAP_EMAILS || '').trim();

  const extras = extraRaw

    ? extraRaw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)

    : [];



  const byEmail = new Map(DEFAULT_DEV_ACCOUNTS.map((a) => [a.email, a]));

  if (!byEmail.has(adminEmail)) {

    byEmail.set(adminEmail, { email: adminEmail, name: 'Dev Admin' });

  }

  for (const email of extras) {

    if (!byEmail.has(email)) {

      byEmail.set(email, { email, name: 'Dev User' });

    }

  }

  return [...byEmail.values()];

}



async function ensureDevAdminUser() {

  if (process.env.NODE_ENV === 'production') return;

  if (process.env.SKIP_DEV_ADMIN_BOOTSTRAP === 'true') return;



  const User = require('../models/User');

  const { getRandomAvatar } = require('./avatarGenerator');

  const seedPassword = getDefaultSeedPassword();

  const accounts = resolveDevAccounts();



  await seedDepartments();

  const adminDept = await Department.findOne({ slug: ADMIN_SLUG });

  if (!adminDept) {

    logger.warn('authBootstrap', 'Admin department missing — skip dev admin assignment');

    return;

  }



  for (const account of accounts) {

    const email = account.email.trim().toLowerCase();

    // eslint-disable-next-line no-await-in-loop

    let user = await User.findOne({ email }).select('+password').setOptions({ bypassTenant: true });



    if (!user) {

      const { name } = normalizePersonName(account.name);

      // eslint-disable-next-line no-await-in-loop

      user = await User.create({

        name,

        email,

        password: seedPassword,

        gender: 'male',

        avatar: getRandomAvatar('male'),

        passwordChangedAt: new Date(),

        mustChangePassword: true,

        departmentId: adminDept._id,

      });

      logger.info('authBootstrap', 'Created dev login account with admin department', { email });

    } else if (!user.password) {

      user.password = seedPassword;

      user.mustChangePassword = true;

      user.passwordChangedAt = new Date();

      // eslint-disable-next-line no-await-in-loop

      await user.save();

      logger.info('authBootstrap', 'Set password on OAuth-only dev account', { email });

    } else {

      // eslint-disable-next-line no-await-in-loop

      const matchesSeed = await user.comparePassword(seedPassword);

      if (!matchesSeed) {

        user.password = seedPassword;

        user.mustChangePassword = true;

        user.passwordChangedAt = new Date();

        // eslint-disable-next-line no-await-in-loop

        await user.save();

        logger.info('authBootstrap', 'Synced dev account password to default seed', { email });

      }

    }



    if (user.departmentId?.toString() !== adminDept._id.toString()) {

      user.departmentId = adminDept._id;

      // eslint-disable-next-line no-await-in-loop

      await user.save();

      logger.info('authBootstrap', 'Assigned admin department to dev account', { email });

    }

  }

}



module.exports = { ensureDevAdminUser, resolveDevAccounts };



if (require.main === module) {

  require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

  const mongoose = require('mongoose');

  const uri = (process.env.MONGODB_URI || '').trim();

  if (!uri) {

    console.error('MONGODB_URI not set in server/.env');

    process.exit(1);

  }

  if (!uri.includes('taskmaster_local')) {

    console.error('Refusing to run: MONGODB_URI must target taskmaster_local');

    process.exit(1);

  }



  mongoose.connect(uri)

    .then(() => ensureDevAdminUser())

    .then(() => mongoose.disconnect())

    .catch((err) => {

      console.error(err);

      process.exit(1);

    });

}


