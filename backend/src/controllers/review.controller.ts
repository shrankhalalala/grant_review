import type { RequestHandler } from "express";
import { HttpError } from "../middleware/errorHandler.js";
import { completeReview, createReview, declareConflict, getReview, updateReview } from "../services/review.service.js";
import { readConflictReason, readReviewInput } from "../utils/reviewValidation.js";

function id(value: string | string[] | undefined, name: string) { if (typeof value !== "string" || !value) throw new HttpError(400, `A valid ${name} is required.`); return value; }
function actor(request: Parameters<RequestHandler>[0]) { if (!request.auth) throw new HttpError(401, "Authentication required."); return request.auth.userId; }
export const create: RequestHandler = async (req, res, next) => { try { res.status(201).json({ review: await createReview(id(req.params.assignmentId, "assignment ID"), readReviewInput(req.body), actor(req)) }); } catch (error) { next(error); } };
export const get: RequestHandler = async (req, res, next) => { try { res.json({ review: await getReview(id(req.params.assignmentId, "assignment ID"), actor(req)) }); } catch (error) { next(error); } };
export const update: RequestHandler = async (req, res, next) => { try { res.json({ review: await updateReview(id(req.params.reviewId, "review ID"), readReviewInput(req.body, true), actor(req)) }); } catch (error) { next(error); } };
export const complete: RequestHandler = async (req, res, next) => { try { res.json({ review: await completeReview(id(req.params.reviewId, "review ID"), actor(req)) }); } catch (error) { next(error); } };
export const conflict: RequestHandler = async (req, res, next) => { try { res.status(201).json({ conflict: await declareConflict(id(req.params.assignmentId, "assignment ID"), readConflictReason(req.body), actor(req)) }); } catch (error) { next(error); } };
