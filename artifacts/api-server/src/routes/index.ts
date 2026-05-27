import { Router, type IRouter } from "express";
import healthRouter from "./health";
import mongoRouter from "./mongo";
import fileAnalyticsRouter from "./fileanalytics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(mongoRouter);
router.use(fileAnalyticsRouter);

export default router;
