/**
 * Ghost Budget — Categories Module
 * CRUD operations for categories
 */

import { supabase } from './client.js';

/**
 * Get all categories for current user
 * @param {string} type - 'expense' or 'income' (optional)
 * @returns {Promise<Array>}
 */
export async function getCategories(type = null) {
    let query = supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

    if (type) {
        query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching categories:', error);
        return [];
    }
    return data || [];
}

/**
 * Get category by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getCategoryById(id) {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching category:', error);
        return null;
    }
    return data;
}

/**
 * Get category by name and type
 * @param {string} name
 * @param {string} type
 * @returns {Promise<Object|null>}
 */
export async function getCategoryByName(name, type) {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('name', name)
        .eq('type', type)
        .single();

    if (error && error.code !== 'PGRST116') { // Not found is ok
        console.error('Error fetching category by name:', error);
    }
    return data || null;
}

/**
 * Create a new category
 * @param {Object} category - { name, type, icon?, color? }
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function createCategory({ name, type, icon = null, color = null }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: new Error('Not authenticated') };

    if (!name || !name.trim()) {
        return { data: null, error: new Error('Введи название категории') };
    }

    if (!['expense', 'income'].includes(type)) {
        return { data: null, error: new Error('Неверный тип категории') };
    }

    const { data, error } = await supabase
        .from('categories')
        .insert({
            user_id: user.id,
            name: name.trim(),
            type,
            icon,
            color
        })
        .select()
        .single();

    return { data, error };
}

/**
 * Get or create category by name
 * @param {string} name
 * @param {string} type
 * @returns {Promise<Object|null>}
 */
export async function getOrCreateCategory(name, type) {
    // Try to find existing
    let category = await getCategoryByName(name, type);
    if (category) return category;

    // Create new
    const { data, error } = await createCategory({ name, type });
    if (error) {
        // Might be race condition, try to fetch again
        return await getCategoryByName(name, type);
    }
    return data;
}

/**
 * Update a category
 * @param {string} id
 * @param {Object} updates - { name?, icon?, color?, sort_order? }
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function updateCategory(id, updates) {
    const { data, error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    return { data, error };
}

/**
 * Delete a category
 * @param {string} id
 * @returns {Promise<{error: Error|null}>}
 */
export async function deleteCategory(id) {
    const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

    return { error };
}
