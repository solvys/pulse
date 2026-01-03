/**
 * Admin Annotations Service
 * CRUD operations for admin annotations used in RAG-based AI learning
 */
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
export declare function createAnnotation(adminUserId: string, targetType: string, targetId: string, comment: string, selectedText?: string): Promise<AdminAnnotation>;
/**
 * Get annotations for a specific target
 */
export declare function getAnnotationsForTarget(targetType: string, targetId: string): Promise<AdminAnnotation[]>;
/**
 * Get relevant annotations for RAG context injection
 * Returns recent annotations formatted for AI context
 */
export declare function getRelevantAnnotationsForContext(limit?: number): Promise<string[]>;
/**
 * Get annotations by target type (for news, AI messages, or IV scores)
 */
export declare function getAnnotationsByType(targetType: string, limit?: number, offset?: number): Promise<AdminAnnotation[]>;
/**
 * List all annotations with pagination
 */
export declare function listAllAnnotations(limit?: number, offset?: number): Promise<AdminAnnotation[]>;
/**
 * Delete an annotation (admin only)
 */
export declare function deleteAnnotation(id: number, adminUserId: string): Promise<boolean>;
/**
 * Get annotation count for stats
 */
export declare function getAnnotationStats(): Promise<{
    total: number;
    byType: Record<string, number>;
}>;
//# sourceMappingURL=admin-annotations-service.d.ts.map