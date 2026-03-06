import { supabase } from './supabase';
import { Sale, Product, ProductImage, InventoryItem, Store, Employee, Customer, Romaneio, OrderStatus, Supplier, InventoryMovement } from '../types';

// ─── Cache localStorage com TTL ───────────────────────────────────────────────
const CACHE_TTL: Record<string, number> = {
    products: 12 * 60 * 60 * 1000,   // 12 horas
    stores: 12 * 60 * 60 * 1000,     // 12 horas
    suppliers: 12 * 60 * 60 * 1000,  // 12 horas
    employees: 60 * 60 * 1000,       // 1 hora (employees mudam mais que produtos)
};

function cacheGet<T>(key: string): T | null {
    try {
        const raw = localStorage.getItem(`lm_cache_${key}`);
        if (!raw) return null;
        const { data, ts } = JSON.parse(raw);
        const ttl = CACHE_TTL[key] ?? 10 * 60 * 1000;
        if (Date.now() - ts > ttl) {
            localStorage.removeItem(`lm_cache_${key}`);
            return null;
        }
        return data as T;
    } catch { return null; }
}

function cacheSet(key: string, data: unknown): void {
    try {
        localStorage.setItem(`lm_cache_${key}`, JSON.stringify({ data, ts: Date.now() }));
    } catch { /* quota exceeded — ignore */ }
}

export function cacheInvalidate(key: string): void {
    localStorage.removeItem(`lm_cache_${key}`);
}

export function cacheInvalidateAll(): void {
    ['products', 'stores', 'suppliers', 'employees'].forEach(k =>
        localStorage.removeItem(`lm_cache_${k}`)
    );
}
// ──────────────────────────────────────────────────────────────────────────────

const base64ToBlob = (base64: string) => {
    const parts = base64.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
};

export const supabaseService = {
    // STORES
    async getStores(bypassCache = false) {
        if (!bypassCache) {
            const cached = cacheGet<Store[]>('stores');
            if (cached) return cached;
        }
        const { data, error } = await supabase.from('stores').select('*');
        if (error) throw error;
        const result = data as Store[];
        cacheSet('stores', result);
        return result;
    },

    // EMPLOYEES
    async getEmployees(bypassCache = false) {
        if (!bypassCache) {
            const cached = cacheGet<Employee[]>('employees');
            if (cached) return cached;
        }
        const { data, error } = await supabase.from('employees').select('*');
        if (error) throw error;
        const result = (data || []).map((e: any) => ({
            id: e.id,
            name: e.name,
            role: e.role,
            username: e.username,
            password: e.password,
            active: e.active,
            storeId: e.store_id
        })) as Employee[];
        cacheSet('employees', result);
        return result;
    },

    // SUPPLIERS
    async getSuppliers(bypassCache = false) {
        if (!bypassCache) {
            const cached = cacheGet<Supplier[]>('suppliers');
            if (cached) return cached;
        }
        const { data, error } = await supabase.from('suppliers').select('*').order('name', { ascending: true });
        if (error) throw error;
        const result = (data || []).map((s: any) => ({
            id: s.id,
            name: s.name,
            active: s.active
        })) as Supplier[];
        cacheSet('suppliers', result);
        return result;
    },

    async createSupplier(supplier: Supplier) {
        const payload: any = {
            id: supplier.id,
            name: supplier.name,
            active: supplier.active
        };
        const { error } = await supabase.from('suppliers').insert(payload);
        if (error) throw error;
        cacheInvalidate('suppliers');
        return true;
    },

    async updateSupplier(id: string, updates: Partial<Supplier>) {
        const payload: any = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.active !== undefined) payload.active = updates.active;

        const { error } = await supabase.from('suppliers').update(payload).eq('id', id);
        if (error) throw error;
        cacheInvalidate('suppliers');
        return true;
    },

    // PRODUCTS
    async getProducts(bypassCache = false) {
        if (!bypassCache) {
            const cached = cacheGet<Product[]>('products');
            if (cached) return cached;
        }
        let allItems: Product[] = [];
        let hasMore = true;
        let page = 0;
        const limit = 1000;

        while (hasMore) {
            const { data, error } = await supabase.from('products').select('*').order('id', { ascending: true }).range(page * limit, (page + 1) * limit - 1);
            if (error) throw error;

            if (data && data.length > 0) {
                const mapped = data.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    category: p.category,
                    price: p.price,
                    costPrice: p.cost_price,
                    assemblyPrice: p.assembly_price,
                    sku: p.sku,
                    imageUrl: p.image_url,
                    imageUrl2: p.image_url_2,
                    supplierId: p.supplier_id,
                    description: p.description,
                    active: typeof p.active !== 'undefined' ? p.active : true
                }));
                allItems = allItems.concat(mapped as Product[]);
                page++;
                if (data.length < limit) hasMore = false;
            } else {
                hasMore = false;
            }
        }
        cacheSet('products', allItems);
        return allItems;
    },

    async updateProduct(id: string, updates: Partial<Product>) {
        const payload: any = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.sku !== undefined) payload.sku = updates.sku;
        if (updates.category !== undefined) payload.category = updates.category;
        if (updates.price !== undefined) payload.price = updates.price;
        if (updates.costPrice !== undefined) payload.cost_price = updates.costPrice;
        if (updates.assemblyPrice !== undefined) payload.assembly_price = updates.assemblyPrice;
        if (updates.supplierId !== undefined) payload.supplier_id = updates.supplierId;
        if (updates.imageUrl !== undefined) payload.image_url = updates.imageUrl;
        if (updates.imageUrl2 !== undefined) payload.image_url_2 = updates.imageUrl2;
        if (updates.description !== undefined) payload.description = updates.description;
        if (updates.active !== undefined) payload.active = updates.active;
        const { error } = await supabase.from('products').update(payload).eq('id', id);
        if (error) throw error;
        cacheInvalidate('products');
        return true;
    },

    async createProduct(product: Product) {
        const payload: any = {
            id: product.id,
            name: product.name,
            sku: product.sku,
            category: product.category,
            price: product.price,
            cost_price: product.costPrice,
            assembly_price: product.assemblyPrice,
            supplier_id: product.supplierId || null,
            image_url: product.imageUrl || null,
            image_url_2: product.imageUrl2 || null,
            description: product.description || null,
            active: typeof product.active !== 'undefined' ? product.active : true
        };
        const { error } = await supabase.from('products').insert(payload);
        if (error) throw error;
        cacheInvalidate('products');
        return true;
    },

    // PRODUCT IMAGES
    async getProductImages(productId: string): Promise<ProductImage[]> {
        const { data, error } = await supabase
            .from('product_images')
            .select('*')
            .eq('product_id', productId)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return (data || []).map((r: any) => ({
            id: r.id,
            productId: r.product_id,
            storagePath: r.storage_path,
            url: r.url,
            sortOrder: r.sort_order,
            createdAt: r.created_at
        }));
    },

    async uploadProductImage(file: File, productId: string): Promise<ProductImage> {
        const ext = file.name.split('.').pop() || 'webp';
        const path = `products/${productId}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(path, file, { upsert: false, contentType: file.type });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
            .from('product-images')
            .getPublicUrl(path);
        const publicUrl = urlData.publicUrl;

        const { data, error } = await supabase.from('product_images').insert({
            product_id: productId,
            storage_path: path,
            url: publicUrl,
            sort_order: 0
        }).select().single();
        if (error) throw error;
        return {
            id: data.id,
            productId: data.product_id,
            storagePath: data.storage_path,
            url: data.url,
            sortOrder: data.sort_order
        };
    },

    async deleteProductImage(id: string, storagePath: string) {
        await supabase.storage.from('product-images').remove([storagePath]);
        const { error } = await supabase.from('product_images').delete().eq('id', id);
        if (error) throw error;
        return true;
    },

    // INVENTORY
    async getInventory() {
        let allItems: any[] = [];
        let hasMore = true;
        let page = 0;
        const limit = 1000;

        while (hasMore) {
            const { data, error } = await supabase.from('inventory').select('*').order('product_id', { ascending: true }).range(page * limit, (page + 1) * limit - 1);
            if (error) throw error;

            if (data && data.length > 0) {
                allItems = allItems.concat(data);
                page++;
                if (data.length < limit) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        return allItems.map((i: any) => ({
            productId: i.product_id,
            locationId: i.location_id,
            quantity: i.quantity,
            type: i.type,
            lastUpdated: i.last_updated
        })) as InventoryItem[];
    },

    // SALES
    async getSales(startDate?: string, endDate?: string) {
        let query = supabase
            .from('sales')
            .select('*, items:sale_items(*), payments:sale_payments(*)')
            .order('created_at', { ascending: false });

        if (startDate) {
            query = query.gte('date', startDate);
        } else {
            // Padrão: Últimos 7 dias OU status não finalizado
            const defaultDate = new Date();
            defaultDate.setDate(defaultDate.getDate() - 7);
            const dateStr = defaultDate.toISOString().split('T')[0];

            // Queremos: (date >= defaultDate) OR (status NOT IN (COMPLETED, CANCELED))
            // No Supabase JS, filtros complexos OR são feitos com .or()
            query = query.or(`date.gte.${dateStr},status.not.in.("${OrderStatus.COMPLETED}","${OrderStatus.CANCELED}")`);
        }

        if (endDate) {
            // Garante que o filtro inclua todo o dia selecionado (até o último segundo)
            query = query.lte('date', `${endDate}T23:59:59.999Z`);
        }

        const { data, error } = await query;

        if (error) throw error;
        return (data || []).map((s: any) => ({
            id: s.id,
            date: s.date,
            customerName: s.customer_name,
            customerCpf: s.customer_cpf,
            customerPhone: s.customer_phone,
            customerEmail: s.customer_email,
            customerReference: s.customer_reference,
            storeId: s.store_id,
            sellerId: s.seller_id,
            total: s.total,
            status: s.status,
            deliveryAddress: s.delivery_address,
            deliveryObs: s.delivery_obs,
            assemblyRequired: s.assembly_required,
            assignedDriverId: s.assigned_driver_id,
            assignedAssemblerId: s.assigned_assembler_id,
            assemblyCompletedAt: s.assembly_completed_at || null,
            deliveryDate: s.delivery_date || null,
            items: (s.items || []).map((i: any) => ({
                id: i.id,
                productId: i.product_id,
                quantity: i.quantity,
                price: i.price,
                discount: i.discount,
                originalPrice: i.original_price,
                locationId: i.location_id,
                assemblyRequired: i.assembly_required,
                dispatchStatus: i.dispatch_status
            })),
            payments: (s.payments || []).map((p: any) => ({
                method: p.method,
                amount: p.amount,
                status: p.status
            }))
        })) as Sale[];
    },

    async getNextSaleId() {
        // Busca os IDs mais recentes para evitar limites de paginação e encontrar o maior número atual
        const { data, error } = await supabase
            .from('sales')
            .select('id')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        const ids = (data || []).map(s => parseInt(s.id)).filter(n => !isNaN(n));
        const lastIdNum = ids.length > 0 ? Math.max(...ids) : 100;

        // Garante que o novo ID seja único tentando o próximo número disponível
        return (lastIdNum + 1).toString();
    },

    async createSale(sale: Sale) {
        // 1. Inserir cabeçalho da venda
        const { error: saleError } = await supabase.from('sales').insert({
            id: sale.id,
            date: sale.date,
            customer_name: sale.customerName,
            customer_cpf: sale.customerCpf,
            customer_phone: sale.customerPhone,
            customer_email: sale.customerEmail,
            customer_reference: sale.customerReference,
            store_id: sale.storeId || null,
            seller_id: sale.sellerId || null, // send null not '' to avoid FK violation
            total: sale.total,
            status: sale.status,
            delivery_address: sale.deliveryAddress,
            delivery_obs: sale.deliveryObs,
            assembly_required: sale.assemblyRequired,
            assigned_driver_id: sale.assignedDriverId || null,
            assigned_assembler_id: sale.assignedAssemblerId || null
        });

        if (saleError) throw saleError;

        // 2. Inserir itens
        const itemsToInsert = sale.items.map(item => ({
            sale_id: sale.id,
            product_id: item.productId,
            quantity: item.quantity,
            price: item.price,
            discount: item.discount,
            original_price: item.originalPrice,
            location_id: item.locationId || null,
            assembly_required: item.assemblyRequired
        }));

        const { error: itemsError } = await supabase.from('sale_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;

        // 3. Inserir pagamentos
        const paymentsToInsert = sale.payments.map(p => ({
            sale_id: sale.id,
            method: p.method,
            amount: p.amount,
            status: p.method === 'Entrega' ? 'PENDENTE_ENTREGA' : 'CONFERIDO'
        }));

        const { error: paymentsError } = await supabase.from('sale_payments').insert(paymentsToInsert);
        if (paymentsError) throw paymentsError;

        // 4. Registrar movimentos de estoque
        for (const item of sale.items) {
            const isVirtual = item.locationId === 'ST-MOSTRUARIO' || item.locationId === 'ST-ENCOMENDA';
            if (!isVirtual && item.locationId) {
                await this.logInventoryMovement({
                    productId: item.productId,
                    locationId: item.locationId,
                    quantity: item.quantity,
                    type: 'SAIDA',
                    referenceId: sale.id,
                    reason: 'VENDA',
                    createdBy: sale.sellerId
                });
            }
        }

        return true;
    },

    async updateInventory(productId: string, locationId: string, quantity: number, type?: string) {
        const payload: any = { product_id: productId, location_id: locationId, quantity };
        if (type) payload.type = type;
        const { error } = await supabase
            .from('inventory')
            .upsert(payload, { onConflict: 'product_id,location_id' });

        if (error) throw error;
        return true;
    },

    async logInventoryMovement(movement: Partial<InventoryMovement>) {
        const payload = {
            product_id: movement.productId,
            location_id: movement.locationId,
            quantity: movement.quantity,
            type: movement.type,
            reference_id: movement.referenceId,
            reason: movement.reason,
            created_by: movement.createdBy
        };
        const { error } = await supabase.from('inventory_movements').insert(payload);
        if (error) throw error;
        return true;
    },

    async getProductMovements(productId: string) {
        const { data, error } = await supabase
            .from('inventory_movements')
            .select('*')
            .eq('product_id', productId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map((m: any) => ({
            id: m.id,
            productId: m.product_id,
            locationId: m.location_id,
            quantity: m.quantity,
            type: m.type,
            referenceId: m.reference_id,
            reason: m.reason,
            createdAt: m.created_at,
            createdBy: m.created_by
        })) as InventoryMovement[];
    },

    async updateSaleStatus(saleId: string, status: string, extra?: any) {
        const payload: any = { status };

        if (status === 'Entregue' || status === 'Entregue - Aguardando Montagem') {
            payload.delivery_date = new Date().toISOString().split('T')[0];
        }
        if (status === OrderStatus.COMPLETED) {
            payload.assembly_completed_at = new Date().toISOString();
        }

        // --- EXCESSO DE USO FIX: Mudar Base64 para Storage ---
        if (extra?.deliverySignature && extra.deliverySignature.startsWith('data:image')) {
            try {
                const blob = base64ToBlob(extra.deliverySignature);
                const path = `signatures/${saleId}_${Date.now()}.png`;
                const { error: upErr } = await supabase.storage.from('delivery-comprovantes').upload(path, blob);
                if (!upErr) {
                    const { data: urlData } = supabase.storage.from('delivery-comprovantes').getPublicUrl(path);
                    payload.delivery_signature = urlData.publicUrl;
                }
            } catch (err) {
                console.error("Erro ao subir assinatura:", err);
            }
        } else if (extra?.deliverySignature) {
            payload.delivery_signature = extra.deliverySignature;
        }

        if (extra?.deliveryPhoto && extra.deliveryPhoto.startsWith('data:image')) {
            try {
                const blob = base64ToBlob(extra.deliveryPhoto);
                const path = `photos/${saleId}_${Date.now()}.jpg`;
                const { error: upErr } = await supabase.storage.from('delivery-comprovantes').upload(path, blob);
                if (!upErr) {
                    const { data: urlData } = supabase.storage.from('delivery-comprovantes').getPublicUrl(path);
                    payload.delivery_photo = urlData.publicUrl;
                }
            } catch (err) {
                console.error("Erro ao subir foto:", err);
            }
        } else if (extra?.deliveryPhoto) {
            payload.delivery_photo = extra.deliveryPhoto;
        }

        if (extra?.assemblySignature && extra.assemblySignature.startsWith('data:image')) {
            try {
                const blob = base64ToBlob(extra.assemblySignature);
                const path = `assembly_sigs/${saleId}_${Date.now()}.png`;
                const { error: upErr } = await supabase.storage.from('delivery-comprovantes').upload(path, blob);
                if (!upErr) {
                    const { data: urlData } = supabase.storage.from('delivery-comprovantes').getPublicUrl(path);
                    payload.assembly_signature = urlData.publicUrl;
                }
            } catch (err) {
                console.error("Erro ao subir assinatura montagem:", err);
            }
        } else if (extra?.assemblySignature) {
            payload.assembly_signature = extra.assemblySignature;
        }

        const { error } = await supabase
            .from('sales')
            .update(payload)
            .eq('id', saleId);

        if (error) throw error;

        // Liberar pagamentos pendentes de entrega para o Acerto Caixa
        if (status === 'Entregue' || status === 'Entregue - Aguardando Montagem') {
            await supabase
                .from('sale_payments')
                .update({ status: 'AGUARDANDO_ACERTO' })
                .eq('sale_id', saleId)
                .eq('status', 'PENDENTE_ENTREGA');
        }

        return true;
    },

    async updateSale(saleId: string, updates: any) {
        const payload: any = {};
        if (updates.assignedDriverId !== undefined) payload.assigned_driver_id = updates.assignedDriverId;
        if (updates.assignedAssemblerId !== undefined) payload.assigned_assembler_id = updates.assignedAssemblerId;
        if (updates.status !== undefined) payload.status = updates.status;

        const { error } = await supabase
            .from('sales')
            .update(payload)
            .eq('id', saleId);

        if (error) throw error;
        return true;
    },

    async createEmployee(employee: Employee) {
        const payload: any = {
            id: employee.id,
            name: employee.name,
            username: employee.username,
            password: employee.password,
            role: employee.role,
            active: employee.active,
            store_id: employee.storeId || null
        };
        const { error } = await supabase.from('employees').insert(payload);
        if (error) throw error;
        cacheInvalidate('employees');
        return true;
    },

    async updateEmployee(id: string, updates: Partial<Employee>) {
        const payload: any = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.username !== undefined) payload.username = updates.username;
        if (updates.password !== undefined) payload.password = updates.password;
        if (updates.role !== undefined) payload.role = updates.role;
        if (updates.active !== undefined) payload.active = updates.active;
        if (updates.storeId !== undefined) payload.store_id = updates.storeId || null;

        const { error } = await supabase.from('employees').update(payload).eq('id', id);
        if (error) throw error;
        cacheInvalidate('employees');
        return true;
    },

    async createStore(store: Store) {
        const payload: Record<string, any> = {
            id: store.id,
            name: store.name,
            type: store.type,
            location: store.location || null,
            phones: store.phones || []
        };
        const { error } = await supabase.from('stores').insert(payload);
        if (error) throw error;
        cacheInvalidate('stores');
        return true;
    },

    async updateStore(id: string, updates: Partial<Store>) {
        const payload: Record<string, any> = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.type !== undefined) payload.type = updates.type;
        if (updates.location !== undefined) payload.location = updates.location;
        if (updates.phones !== undefined) payload.phones = updates.phones;

        const { error } = await supabase.from('stores').update(payload).eq('id', id);
        if (error) throw error;
        cacheInvalidate('stores');
        return true;
    },

    async createTask(task: {
        title: string;
        description?: string;
        type: string;
        status?: string;
        priority: string;
        created_by?: string;
        assigned_to?: string;
        assigned_to_user_id?: string;
        store_id?: string;
        source_store_id?: string;
        sale_id?: string;
        product_name?: string;
    }) {
        const { error } = await supabase.from('tasks').insert({
            title: task.title,
            description: task.description || null,
            type: task.type,
            status: task.status || 'ABERTA',
            priority: task.priority,
            created_by: task.created_by || null,
            assigned_to: task.assigned_to || null,
            assigned_to_user_id: task.assigned_to_user_id || null,
            store_id: task.store_id || null,
            source_store_id: task.source_store_id || null,
            sale_id: task.sale_id || null,
            product_name: task.product_name || null,
        });
        if (error) throw error;
        return true;
    },

    async respondTask(taskId: string, response: string, respondedBy: string) {
        const { error } = await supabase.from('tasks').update({
            response,
            responded_by: respondedBy,
            responded_at: new Date().toISOString(),
        }).eq('id', taskId);
        if (error) throw error;
        return true;
    },

    // FINANCE / PAYMENTS
    async confirmPaymentStatus(saleId: string, amount: number) {
        const { error } = await supabase
            .from('sale_payments')
            .update({ status: 'CONFERIDO' })
            .eq('sale_id', saleId)
            .eq('method', 'Entrega')
            .eq('amount', amount)
            .in('status', ['PENDENTE_ENTREGA', 'AGUARDANDO_ACERTO', 'PAGO_EM_LOJA']);

        if (error) throw error;
        return true;
    },

    async markPaymentPaidAtStore(saleId: string, amount: number) {
        const { error } = await supabase
            .from('sale_payments')
            .update({ status: 'PAGO_EM_LOJA' })
            .eq('sale_id', saleId)
            .eq('method', 'Entrega')
            .eq('amount', amount)
            .in('status', ['PENDENTE_ENTREGA', 'AGUARDANDO_ACERTO']);

        if (error) throw error;
        return true;
    },


    // AUTH
    async signIn(email: string, pass: string) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password: pass
            });
            if (error) return null;
            return data.user;
        } catch (err) {
            console.error("Auth signin error:", err);
            return null;
        }
    },

    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        return true;
    },

    async getCustomers() {
        const { data, error } = await supabase.from('customers').select('*').order('name', { ascending: true });
        if (error) throw error;
        return (data || []).map((c: any) => ({
            id: c.id,
            type: c.type,
            name: c.name,
            document: c.document,
            email: c.email,
            phone: c.phone,
            zipCode: c.zip_code,
            address: c.address,
            number: c.number,
            complement: c.complement,
            neighborhood: c.neighborhood,
            city: c.city,
            state: c.state,
            reference: c.reference
        })) as Customer[];
    },

    async getEmployeeByEmail(email: string) {
        const { data, error } = await supabase.from('employees').select('*').eq('username', email).single();
        if (error) return null;
        return data as Employee;
    },

    async createCustomer(customer: Customer) {
        const payload: any = {
            id: customer.id,
            type: customer.type,
            name: customer.name,
            document: customer.document,
            email: customer.email,
            phone: customer.phone,
            zip_code: customer.zipCode,
            address: customer.address,
            number: customer.number,
            complement: customer.complement,
            neighborhood: customer.neighborhood,
            city: customer.city,
            state: customer.state,
            reference: customer.reference
        };
        const { error } = await supabase.from('customers').insert(payload);
        if (error) throw error;
        return true;
    },

    async updateCustomer(id: string, updates: Partial<Customer>) {
        const payload: any = { ...updates };
        delete payload.id; // Não permitir alteração de ID

        if (updates.zipCode !== undefined) {
            payload.zip_code = updates.zipCode;
            delete payload.zipCode;
        }
        const { error } = await supabase.from('customers').update(payload).eq('id', id);
        if (error) throw error;
        return true;
    },

    // ROMANEIOS
    async getRomaneios() {
        const { data, error } = await supabase.from('romaneios').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map((r: any) => ({
            id: r.id.toString(),
            type: r.type,
            employeeId: r.employee_id,
            saleIds: r.sale_ids,
            createdAt: r.created_at,
            status: r.status
        })) as Romaneio[];
    },

    async createRomaneio(romaneio: Omit<Romaneio, 'id'>) {
        const { data, error } = await supabase.from('romaneios').insert({
            type: romaneio.type,
            employee_id: romaneio.employeeId,
            sale_ids: romaneio.saleIds,
            status: romaneio.status || 'ATIVO'
        }).select().single();
        if (error) throw error;
        return data.id.toString();
    },

    async deleteRomaneio(romaneioId: string, saleIds: string[], type: 'entrega' | 'montagem') {
        // 1. Reverter as vendas associadas
        const promises = saleIds.map(async id => {
            if (type === 'entrega') {
                return supabase.from('sales').update({
                    assigned_driver_id: null,
                    status: OrderStatus.PENDING
                }).eq('id', id);
            } else {
                return supabase.from('sales').update({
                    assigned_assembler_id: null
                }).eq('id', id);
            }
        });
        await Promise.all(promises);

        // 2. Deletar o romaneio do histórico
        const { error } = await supabase.from('romaneios').delete().eq('id', parseInt(romaneioId));
        if (error) throw error;
        return true;
    },

    async cancelSale(saleId: string) {
        // 1. Buscar itens da venda para estornar estoque
        const { data: items, error: FetchError } = await supabase
            .from('sale_items')
            .select('product_id, quantity, location_id')
            .eq('sale_id', saleId);

        if (FetchError) throw FetchError;

        // 2. Estornar cada item no estoque
        for (const item of (items || [])) {
            // Obter quantidade atual
            const { data: invData } = await supabase
                .from('inventory')
                .select('quantity')
                .eq('product_id', item.product_id)
                .eq('location_id', item.location_id)
                .single();

            const currentQty = invData?.quantity || 0;
            const newQty = currentQty + item.quantity;

            await supabase
                .from('inventory')
                .upsert({
                    product_id: item.product_id,
                    location_id: item.location_id,
                    quantity: newQty
                }, { onConflict: 'product_id,location_id' });

            // Registrar movimento (Devolução por cancelamento)
            await this.logInventoryMovement({
                productId: item.product_id,
                locationId: item.location_id,
                quantity: item.quantity,
                type: 'ENTRADA',
                referenceId: saleId,
                reason: 'CANCELAMENTO',
                createdBy: 'Sistema (Cancelamento)'
            });
        }

        // 3. Atualizar status da venda para Cancelada
        const { error: saleError } = await supabase
            .from('sales')
            .update({ status: 'Cancelada' }) // Usando o rótulo do enum atualizado
            .eq('id', saleId);

        if (saleError) throw saleError;
        return true;
    },

    // Marca a venda como "Cancelamento Pendente" SEM mexer no estoque
    async markSaleCancelPending(saleId: string) {
        const { error } = await supabase
            .from('sales')
            .update({ status: 'Cancelamento Pendente' })
            .eq('id', saleId);
        if (error) throw error;
        return true;
    },

    // Devolve o estoque dos itens da venda para um CD/loja escolhido e cancela a venda
    async restoreInventoryToLocation(saleId: string, targetLocationId: string) {
        console.log(`[restoreInventoryToLocation] Iniciando para Venda ${saleId} -> Local ${targetLocationId}`);
        // 1. Buscar itens da venda
        const { data: items, error: fetchErr } = await supabase
            .from('sale_items')
            .select('product_id, quantity, location_id')
            .eq('sale_id', saleId);

        if (fetchErr) {
            console.error("[restoreInventoryToLocation] Erro ao buscar itens:", fetchErr);
            throw fetchErr;
        }

        if (!items || items.length === 0) {
            console.warn("[restoreInventoryToLocation] Nenhum item encontrado para a venda:", saleId);
        }

        // 2. Devolver cada item ao CD escolhido (ignorar locais virtuais no estorno)
        for (const item of (items || [])) {
            // Se o item saiu originalmente de um local virtual, ainda assim devolvemos para o CD físico escolhido
            // pois o cancelamento implica retorno físico do produto ao estoque.

            const { data: invData, error: invErr } = await supabase
                .from('inventory')
                .select('quantity, type')
                .eq('product_id', item.product_id)
                .eq('location_id', targetLocationId)
                .maybeSingle();

            if (invErr) {
                console.error(`[restoreInventoryToLocation] Erro ao consultar estoque (Prod: ${item.product_id}, Loc: ${targetLocationId}):`, invErr);
                throw invErr;
            }

            const currentQty = invData?.quantity || 0;
            const newQty = currentQty + item.quantity;

            const { error: upsertErr } = await supabase
                .from('inventory')
                .upsert({
                    product_id: item.product_id,
                    location_id: targetLocationId,
                    quantity: newQty,
                    ...(invData?.type ? { type: invData.type } : {})
                }, { onConflict: 'product_id,location_id' });

            if (upsertErr) {
                console.error(`[restoreInventoryToLocation] Erro ao fazer upsert no estoque (Prod: ${item.product_id}, Loc: ${targetLocationId}):`, upsertErr);
                throw upsertErr;
            }

            // Registrar movimento
            await this.logInventoryMovement({
                productId: item.product_id,
                locationId: targetLocationId,
                quantity: item.quantity,
                type: 'ENTRADA',
                referenceId: saleId,
                reason: 'CANCELAMENTO',
                createdBy: 'Sistema'
            });
        }

        // 3. Marcar venda como Cancelada
        const { error: saleErr } = await supabase
            .from('sales')
            .update({ status: 'Cancelada' })
            .eq('id', saleId);

        if (saleErr) {
            console.error("[restoreInventoryToLocation] Erro ao atualizar status da venda:", saleErr);
            throw saleErr;
        }

        // 4. Atualizar itens da expedição
        await supabase.from('sale_items')
            .update({ dispatch_status: 'DEVOLVER' })
            .eq('sale_id', saleId)
            .in('dispatch_status', ['SEPARADO', 'INDISPONIVEL']);

        await supabase.from('sale_items')
            .update({ dispatch_status: 'CANCELADO' })
            .eq('sale_id', saleId)
            .eq('dispatch_status', 'PENDENTE');

        console.log(`[restoreInventoryToLocation] Sucesso para Venda ${saleId}`);
        return true;
    },

    // SALE EDIT AUTHORIZATION FLOW
    async requestSaleEdit(params: {
        saleId: string;
        requestedBy: string;
        storeId: string;
        justification: string;
        originalSnapshot: any;   // venda atual
        proposedSnapshot: any;   // venda com as mudanças
        productNames?: string;
    }) {
        // 1. Criar task com os snapshots
        const { data, error } = await supabase.from('tasks').insert({
            title: `Edição de Venda — Nº ${params.saleId}`,
            description: `Solicitado por: ${params.requestedBy}\n\nJustificativa: ${params.justification}`,
            type: 'EDICAO_PENDENTE',
            status: 'ABERTA',
            priority: 'ALTA',
            created_by: params.requestedBy,
            assigned_to: 'MASTER',
            store_id: params.storeId,
            sale_id: params.saleId,
            product_name: params.productNames || '',
            proposal_snapshot: { original: params.originalSnapshot, proposed: params.proposedSnapshot }
        }).select('id').single();
        if (error) throw error;

        // 2. Marcar venda como "Edição Pendente" para bloquear novas edições
        await supabase.from('sales').update({ status: 'Edição Pendente' }).eq('id', params.saleId);

        return data?.id as string;
    },

    async applySaleEdit(params: {
        saleId: string;
        taskId: string;
        authorizedBy: string;
        originalSnapshot: any;
        proposedSnapshot: any;
        stores: any[];
    }) {
        const { originalSnapshot: orig, proposedSnapshot: proposed } = params;
        const changes: any[] = [];

        // --- Apply item changes ---
        const origItems: any[] = orig.items || [];
        const propItems: any[] = proposed.items || [];

        // Find removed / reduced items → delete if PENDENTE (not yet separated), DEVOLVER if already SEPARADO
        for (const origItem of origItems) {
            const propItem = propItems.find((i: any) => i.productId === origItem.productId && i.locationId === origItem.locationId);
            if (!propItem) {
                // Item completely removed
                const { data: siData } = await supabase.from('sale_items')
                    .select('id, dispatch_status').eq('sale_id', params.saleId).eq('product_id', origItem.productId)
                    .not('dispatch_status', 'in', '("DEVOLVER","DEVOLVIDO")').maybeSingle();
                if (siData?.id) {
                    if (siData.dispatch_status === 'PENDENTE') {
                        // Ainda não separado → deletar da expedição e devolver estoque
                        await supabase.from('sale_items').delete().eq('id', siData.id);
                        const isVirtual = origItem.locationId === 'ST-ENCOMENDA' || origItem.locationId === 'ST-MOSTRUARIO';
                        if (!isVirtual && origItem.locationId) {
                            const { data: invData } = await supabase.from('inventory').select('quantity').eq('product_id', origItem.productId).eq('location_id', origItem.locationId).single();
                            const newQty = (invData?.quantity || 0) + origItem.quantity;
                            await supabase.from('inventory').upsert({ product_id: origItem.productId, location_id: origItem.locationId, quantity: newQty }, { onConflict: 'product_id,location_id' });

                            // Registrar movimento (Devolução por remoção na edição)
                            await this.logInventoryMovement({
                                productId: origItem.productId,
                                locationId: origItem.locationId,
                                quantity: origItem.quantity,
                                type: 'ENTRADA',
                                referenceId: params.saleId,
                                reason: 'AJUSTE',
                                createdBy: params.authorizedBy
                            });
                        }
                    } else {
                        // Já separado/indisponível → marcar para devolução física no CD
                        await supabase.from('sale_items').update({ dispatch_status: 'DEVOLVER', quantity: origItem.quantity }).eq('id', siData.id);
                    }
                }
                changes.push({ field: 'item_removed', product_id: origItem.productId, old_value: origItem.quantity, new_value: 0 });
            } else if (propItem.quantity < origItem.quantity) {
                // Quantity reduced
                const { data: siData } = await supabase.from('sale_items')
                    .select('id, dispatch_status').eq('sale_id', params.saleId).eq('product_id', origItem.productId)
                    .not('dispatch_status', 'in', '("DEVOLVER","DEVOLVIDO")').maybeSingle();
                if (siData?.id) {
                    const diff = origItem.quantity - propItem.quantity;
                    if (siData.dispatch_status === 'PENDENTE') {
                        // Ainda não separado → só atualizar a quantidade e devolver diff ao estoque original
                        await supabase.from('sale_items').update({ quantity: propItem.quantity, price: propItem.price, discount: propItem.discount || 0 }).eq('id', siData.id);
                        const isVirtual = origItem.locationId === 'ST-ENCOMENDA' || origItem.locationId === 'ST-MOSTRUARIO';
                        if (!isVirtual && origItem.locationId) {
                            const { data: invData } = await supabase.from('inventory').select('quantity').eq('product_id', origItem.productId).eq('location_id', origItem.locationId).single();
                            const newQty = (invData?.quantity || 0) + diff;
                            await supabase.from('inventory').upsert({ product_id: origItem.productId, location_id: origItem.locationId, quantity: newQty }, { onConflict: 'product_id,location_id' });

                            // Registrar movimento (Devolução parcial por redução na edição)
                            await this.logInventoryMovement({
                                productId: origItem.productId,
                                locationId: origItem.locationId,
                                quantity: diff,
                                type: 'ENTRADA',
                                referenceId: params.saleId,
                                reason: 'AJUSTE',
                                createdBy: params.authorizedBy
                            });
                        }
                    } else {
                        // Já separado → criar entrada DEVOLVER p/ devolução física da diferença
                        await supabase.from('sale_items').insert({
                            sale_id: params.saleId,
                            product_id: origItem.productId,
                            quantity: diff,
                            price: origItem.price,
                            discount: origItem.discount || 0,
                            location_id: origItem.locationId,
                            assembly_required: origItem.assemblyRequired || false,
                            dispatch_status: 'DEVOLVER',
                        });
                        await supabase.from('sale_items').update({ quantity: propItem.quantity, price: propItem.price, discount: propItem.discount || 0 }).eq('id', siData.id);
                    }
                }
                changes.push({ field: 'item_qty_reduced', product_id: origItem.productId, old_value: origItem.quantity, new_value: propItem.quantity });
            } else if (propItem.price !== origItem.price || propItem.discount !== origItem.discount) {
                // Only price/discount changed
                const { data: siData } = await supabase.from('sale_items')
                    .select('id').eq('sale_id', params.saleId).eq('product_id', origItem.productId)
                    .not('dispatch_status', 'in', '("DEVOLVER","DEVOLVIDO")').maybeSingle();
                if (siData?.id) {
                    await supabase.from('sale_items').update({ price: propItem.price, discount: propItem.discount || 0 }).eq('id', siData.id);
                }
                changes.push({ field: 'item_value', product_id: origItem.productId, old_value: { price: origItem.price, discount: origItem.discount }, new_value: { price: propItem.price, discount: propItem.discount } });
            }
        }

        // Find added items → insert as PENDENTE only if no active row exists (prevents duplicates)
        for (const propItem of propItems) {
            const origItem = origItems.find((i: any) => i.productId === propItem.productId && i.locationId === propItem.locationId);
            if (!origItem) {
                // Check if an active row already exists to prevent duplicate entries in expedition
                const { data: existingRows } = await supabase.from('sale_items')
                    .select('id').eq('sale_id', params.saleId).eq('product_id', propItem.productId)
                    .not('dispatch_status', 'in', '("DEVOLVER","DEVOLVIDO")');

                if (!existingRows || existingRows.length === 0) {
                    await supabase.from('sale_items').insert({
                        sale_id: params.saleId,
                        product_id: propItem.productId,
                        quantity: propItem.quantity,
                        price: propItem.price,
                        discount: propItem.discount || 0,
                        location_id: propItem.locationId,
                        assembly_required: propItem.assemblyRequired || false,
                        dispatch_status: 'PENDENTE',
                    });
                    // Deduct inventory for new item (skip virtual locations)
                    const isVirtual = propItem.locationId === 'ST-ENCOMENDA' || propItem.locationId === 'ST-MOSTRUARIO';
                    if (!isVirtual && propItem.locationId) {
                        const { data: invData } = await supabase.from('inventory').select('quantity').eq('product_id', propItem.productId).eq('location_id', propItem.locationId).single();
                        const newQty = Math.max(0, (invData?.quantity || 0) - propItem.quantity);
                        await supabase.from('inventory').upsert({ product_id: propItem.productId, location_id: propItem.locationId, quantity: newQty }, { onConflict: 'product_id,location_id' });

                        // Registrar movimento (Saída por adição na edição)
                        await this.logInventoryMovement({
                            productId: propItem.productId,
                            locationId: propItem.locationId,
                            quantity: propItem.quantity,
                            type: 'SAIDA',
                            referenceId: params.saleId,
                            reason: 'VENDA',
                            createdBy: params.authorizedBy
                        });
                    }
                    changes.push({ field: 'item_added', product_id: propItem.productId, new_value: propItem.quantity });
                }
            }
        }


        // --- Update payments ---
        const origPayments: any[] = orig.payments || [];
        const propPayments: any[] = proposed.payments || [];
        if (JSON.stringify(origPayments) !== JSON.stringify(propPayments)) {
            await supabase.from('sale_payments').delete().eq('sale_id', params.saleId);
            for (const p of propPayments) {
                await supabase.from('sale_payments').insert({
                    sale_id: params.saleId,
                    method: p.method,
                    amount: p.amount,
                    details: p.details || null,
                    status: p.status || null,
                });
            }
            changes.push({ field: 'payments', old_value: origPayments, new_value: propPayments });
        }

        // Update sale total
        const newTotal = propItems.reduce((acc: number, i: any) => acc + (i.price * i.quantity), 0);
        const prevStatus = orig.status === 'Edição Pendente' ? (orig.prevStatus || 'Aguardando Entrega') : orig.status;
        await supabase.from('sales').update({ total: newTotal, status: prevStatus }).eq('id', params.saleId);

        // Close the task
        await supabase.from('tasks').update({ status: 'CONCLUIDA', resolved_at: new Date().toISOString(), notes: `Autorizado por ${params.authorizedBy}` }).eq('id', params.taskId);

        // Save audit log
        await supabase.from('sale_edit_logs').insert({
            sale_id: params.saleId,
            task_id: params.taskId,
            requested_by: orig.requestedBy || 'N/D',
            authorized_by: params.authorizedBy,
            authorized_at: new Date().toISOString(),
            justification: orig.justification || '',
            original_snapshot: params.originalSnapshot,
            proposed_snapshot: params.proposedSnapshot,
            changes,
            status: 'AUTORIZADA',
        });

        return true;
    },

    async rejectSaleEdit(params: { saleId: string; taskId: string; rejectedBy: string; }) {
        // Restore sale status (remove Edição Pendente)
        await supabase.from('sales').update({ status: 'Aguardando Entrega' }).eq('id', params.saleId);
        await supabase.from('tasks').update({ status: 'CONCLUIDA', resolved_at: new Date().toISOString(), notes: `Rejeitado por ${params.rejectedBy}` }).eq('id', params.taskId);
        await supabase.from('sale_edit_logs').insert({
            sale_id: params.saleId,
            task_id: params.taskId,
            rejected_by: params.rejectedBy,
            rejected_at: new Date().toISOString(),
            status: 'REJEITADA',
        });
        return true;
    },

    async confirmExpeditionReturn(saleItemId: string, targetLocationId: string) {
        // Get item data
        const { data: item, error: fetchErr } = await supabase.from('sale_items')
            .select('product_id, quantity').eq('id', saleItemId).single();
        if (fetchErr || !item) throw fetchErr || new Error('Item não encontrado');

        // Credit inventory
        const { data: invData } = await supabase.from('inventory')
            .select('quantity, type').eq('product_id', item.product_id).eq('location_id', targetLocationId).single();
        const newQty = (invData?.quantity || 0) + item.quantity;
        await supabase.from('inventory').upsert({
            product_id: item.product_id,
            location_id: targetLocationId,
            quantity: newQty,
            ...(invData?.type ? { type: invData.type } : {})
        }, { onConflict: 'product_id,location_id' });

        // Mark item as returned
        await supabase.from('sale_items').update({ dispatch_status: 'DEVOLVIDO' }).eq('id', saleItemId);
        return true;
    },

    // Devolve cada item da venda ao seu location_id ORIGINAL (não um CD único) e cancela a venda
    async restoreInventoryToOriginalLocation(saleId: string) {
        console.log(`[restoreInventoryToOriginalLocation] Iniciando para Venda ${saleId}`);
        // 1. Buscar itens da venda com seus locationIds originais
        const { data: items, error: fetchErr } = await supabase
            .from('sale_items')
            .select('product_id, quantity, location_id')
            .eq('sale_id', saleId);

        if (fetchErr) {
            console.error("[restoreInventoryToOriginalLocation] Erro ao buscar itens:", fetchErr);
            throw fetchErr;
        }

        // 2. Devolver cada item ao seu estoque original (ignorar locais virtuais)
        for (const item of (items || [])) {
            const isVirtual = item.location_id === 'ST-ENCOMENDA' || item.location_id === 'ST-MOSTRUARIO';
            if (isVirtual || !item.location_id) {
                console.log(`[restoreInventoryToOriginalLocation] Pulando local virtual/nulo: ${item.location_id} para prod ${item.product_id}`);
                continue;
            }

            const { data: invData, error: invErr } = await supabase
                .from('inventory')
                .select('quantity, type')
                .eq('product_id', item.product_id)
                .eq('location_id', item.location_id)
                .maybeSingle();

            if (invErr) {
                console.error(`[restoreInventoryToOriginalLocation] Erro ao consultar estoque (Prod: ${item.product_id}, Loc: ${item.location_id}):`, invErr);
                throw invErr;
            }

            const currentQty = invData?.quantity || 0;
            const newQty = currentQty + item.quantity;

            const { error: upsertErr } = await supabase
                .from('inventory')
                .upsert({
                    product_id: item.product_id,
                    location_id: item.location_id,
                    quantity: newQty,
                    ...(invData?.type ? { type: invData.type } : {})
                }, { onConflict: 'product_id,location_id' });

            if (upsertErr) {
                console.error(`[restoreInventoryToOriginalLocation] Erro ao fazer upsert no estoque (Prod: ${item.product_id}, Loc: ${item.location_id}):`, upsertErr);
                throw upsertErr;
            }

            // Registrar movimento
            await this.logInventoryMovement({
                productId: item.product_id,
                locationId: item.location_id,
                quantity: item.quantity,
                type: 'ENTRADA',
                referenceId: saleId,
                reason: 'CANCELAMENTO',
                createdBy: 'Sistema'
            });
        }

        // 3. Marcar venda como Cancelada
        const { error: saleErr } = await supabase
            .from('sales')
            .update({ status: 'Cancelada' })
            .eq('id', saleId);

        if (saleErr) {
            console.error("[restoreInventoryToOriginalLocation] Erro ao atualizar status da venda:", saleErr);
            throw saleErr;
        }

        // 4. Atualizar itens da expedição
        await supabase.from('sale_items')
            .update({ dispatch_status: 'DEVOLVER' })
            .eq('sale_id', saleId)
            .in('dispatch_status', ['SEPARADO', 'INDISPONIVEL']);

        await supabase.from('sale_items')
            .update({ dispatch_status: 'CANCELADO' })
            .eq('sale_id', saleId)
            .eq('dispatch_status', 'PENDENTE');

        console.log(`[restoreInventoryToOriginalLocation] Sucesso para Venda ${saleId}`);
        return true;
    },
};





