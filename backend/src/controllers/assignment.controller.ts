import type { RequestHandler } from "express";
import { HttpError } from "../middleware/errorHandler.js";
import { createAssignment, listApplicationAssignments, listMyAssignments, removeAssignment, updateDueAt } from "../services/assignment.service.js";
import { readAssignmentInput, readDueAt } from "../utils/assignmentValidation.js";
function id(value: string | string[] | undefined, name: string) { if (typeof value !== "string" || !value) throw new HttpError(400, `A valid ${name} is required.`); return value; }
function actor(request: Parameters<RequestHandler>[0]) { if (!request.auth) throw new HttpError(401, "Authentication required."); return request.auth.userId; }
export const create: RequestHandler = async (req,res,next) => { try { res.status(201).json({ assignment: await createAssignment(id(req.params.applicationId,"application ID"), readAssignmentInput(req.body), actor(req)) }); } catch(e){next(e);} };
export const listForApplication: RequestHandler = async (req,res,next) => { try { res.json({ assignments: await listApplicationAssignments(id(req.params.applicationId,"application ID")) }); } catch(e){next(e);} };
export const mine: RequestHandler = async (req,res,next) => { try { res.json({ assignments: await listMyAssignments(actor(req)) }); } catch(e){next(e);} };
export const update: RequestHandler = async (req,res,next) => { try { res.json({ assignment: await updateDueAt(id(req.params.assignmentId,"assignment ID"), readDueAt(req.body), actor(req)) }); } catch(e){next(e);} };
export const remove: RequestHandler = async (req,res,next) => { try { res.json({ assignment: await removeAssignment(id(req.params.assignmentId,"assignment ID"), actor(req)) }); } catch(e){next(e);} };
