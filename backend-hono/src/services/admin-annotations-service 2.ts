/**
 * Admin Annotations Service
 * CRUD operations for admin annotations used in RAG-based AI learning
 */

import { sql } from '../db/index.js';

export interface AdminAnnotation {
    id: number;
    adminUserId: string;
    targetType: 'ai_message' | 'news_article' | 'iv_score';
    targetId: string;
    selectedText: string | null;
    comment: string;
    createdAt: Date;
}

/**
 * Create a new admin annotation
 */
export async function createAnnotation(
    adminUserId: string,
    targetType: string,
    targetId: string,
    comment: string,
    selectedText?: string
): Promise<AdminAnnotation> {
    const [annotation] = await sql`
    INSERT INTO admin_annotations (admin_user_id, target_type, target_id, selected_text, comment)
    VALUES (${adminUserId}, ${targetType}, ${targetId}, ${selectedText || null}, ${comment})
    RETURNING id, admin_user_id, target_type, target_id, selected_text, comment, created_at
  `;

    return {
        id: annotation.id,
        adminUserId: annotation.admin_user_id,
        targetType: annotation.target_type,
        targetId: annotation.target_id,
        selectedText: annotation.selected_text,
        comment: annotation.comment,
        createdAt: annotation.created_at,
    };
}

/**
 * Get annotations for a specific target
 */
export async function getAnnotationsForTarget(
    targetType: string,
    targetId: string
): Promise<AdminAnnotation[]> {
    const annotations = await sql`
    SELECT id, admin_user_id, target_type, target_id, selected_text, comment, created_at
    FROM admin_annotations
    WHERE target_type = ${targetType} AND target_id = ${targetId}
    ORDER BY created_at DESC
  `;

    return annotations.map((a: any) => ({
        id: a.id,
        adminUserId: a.admin_user_id,
        targetType: a.target_type,
        targetId: a.target_id,
        selectedText: a.selected_text,
        comment: a.comment,
        createdAt: a.created_at,
    }));
}

/**
 * Get relevant annotations for RAG context injection
 * Returns recent annotations formatted for AI context
 */
export async function getRelevantAnnotationsForContext(
    limit: number = 20
): Promise<string[]> {
    const annotations = await sql`
    SELECT target_type, selected_text, comment, created_at
    FROM admin_annotations
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

    return annotations.map((a: any) => {
        if (a.selected_text) {
            return `[${a.target_type}] "${a.selected_text}" → ${a.comment}`;
        }
        return `[${a.target_type}] ${a.comment}`;
    });
}

/**
 * Get annotations by target type (for news, AI messages, or IV scores)
 */
export async function getAnnotationsByType(
    targetType: string,
    limit: number = 50,
    offset: number = 0
): Promise<AdminAnnotation[]> {
    const annotations = await sql`
    SELECT id, admin_user_id, target_type, target_id, selected_text, comment, created_at
    FROM admin_annotations
    WHERE target_type = ${targetType}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

    return annotations.map((a: any) => ({
        id: a.id,
        adminUserId: a.admin_user_id,
        targetType: a.target_type,
        targetId: a.target_id,
        selectedText: a.selected_text,
        comment: a.comment,
        createdAt: a.created_at,
    }));
}

/**
 * List all annotations with pagination
 */
export async function listAllAnnotations(
    limit: number = 50,
    offset: number = 0
): Promise<AdminAnnotation[]> {
    const annotations = await sql`
    SELECT id, admin_user_id, target_type, target_id, selected_text, comment, created_at
    FROM admin_annotations
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

    return annotations.map((a: any) => ({
        id: a.id,
        adminUserId: a.admin_user_id,
        targetType: a.target_type,
        targetId: a.target_id,
        selectedText: a.selected_text,
        comment: a.comment,
        createdAt: a.created_at,
    }));
}

/**
 * Delete an annotation (admin only)
 */
export async function deleteAnnotation(
    id: number,
    adminUserId: string
): Promise<boolean> {
    const result = await sql`
    DELETE FROM admin_annotations
    WHERE id = ${id} AND admin_user_id = ${adminUserId}
    RETURNING id
  `;

    return result.length > 0;
}

/**
 * Get annotation count for stats
 */
export async function getAnnotationStats(): Promise<{
    total: number;
    byType: Record<string, number>;
}> {
    const [totalResult] = await sql`
    SELECT COUNT(*)::integer as count FROM admin_annotations
  `;

    const typeResults = await sql`
    SELECT target_type, COUNT(*)::integer as count
    FROM admin_annotations
    GROUP BY target_type
  `;

    const byType: Record<string, number> = {};
    typeResults.forEach((r: any) => {
        byType[r.target_type] = r.count;
    });

    return {
        total: totalResult?.count || 0,
        byType,
    };
}
