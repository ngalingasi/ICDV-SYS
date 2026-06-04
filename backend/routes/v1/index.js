const express = require('express');
const authRoute       = require('./auth.route');
const userRoute       = require('./user.route');
const lookupRoute     = require('./lookup.route');
const icdvRoute       = require('./icdv.route');
const vesselRoute     = require('./vessel.route');
const manifestRoute   = require('./manifest.route');
const vehicleRoute    = require('./vehicle.route');
const driverRoute     = require('./driver.route');
const operationRoute  = require('./operation.route');
const deliveryRoute   = require('./delivery.route');
const dashboardRoute  = require('./icdv_dashboard.route');
const workflowRoute   = require('./workflow.route');
const { fuelRouter }  = require('./fuel.route');
const incidentRoute   = require('./incident.route');
const config = require('../../config/config');

const router = express.Router();

const defaultRoutes = [
  { path: '/auth',       route: authRoute },
  { path: '/users',      route: userRoute },
  { path: '/lookups',    route: lookupRoute },
  { path: '/icdvs',      route: icdvRoute },
  { path: '/dashboard',  route: dashboardRoute },
  { path: '/vessels',    route: vesselRoute },
  { path: '/manifests',  route: manifestRoute },
  { path: '/vehicles',   route: vehicleRoute },
  { path: '/drivers',    route: driverRoute },
  { path: '/operations', route: operationRoute },
  { path: '/deliveries', route: deliveryRoute },
  { path: '/workflow',   route: workflowRoute },
  { path: '/fuel',       route: fuelRouter },
  { path: '/incidents',  route: incidentRoute },
];

defaultRoutes.forEach(({ path, route }) => router.use(path, route));

if (config.env === 'development') {
  const docsRoute = require('./docs.route');
  router.use('/docs', docsRoute);
}

module.exports = router;
