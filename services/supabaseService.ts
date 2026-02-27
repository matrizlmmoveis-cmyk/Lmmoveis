import { supabase } from './supabase';
import { Sale, Product, ProductImage, InventoryItem, Store, Employee, Customer } from '../types';

export const supabaseService = {
    // STORES
    async getStores() {
        const { data, error } = await supabase.from('stores').select('*');
        if (error) throw error;
        return data as Store[];
    },

    // EMPLOYEES
    async getEmployees() {
        const { data, error } = await supabase.from('employees').select('*');
        if (error) throw error;
        return data as Employee[];
    },

    // PRODUCTS
    async getProducts() {
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
                    supplierId: p.supplier_id
                }));
                allItems = allItems.concat(mapped as Product[]);
                page++;
                if (data.length < limit) hasMore = false;
            } else {
                hasMore = false;
            }
        }
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
        const { error } = await supabase.from('products').update(payload).eq('id', id);
        if (error) throw error;
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
    async getSales() {
        const { data, error } = await supabase
            .from('sales')
            .select('*, items:sale_items(*), payments:sale_payments(*)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Sale[];
    },

    async createSale(sale: Sale) {
        // 1. Inserir cabeçalho da venda
        const { error: saleError } = await supabase.from('sales').insert({
            id: sale.id,
            customer_name: sale.customerName,
            customer_cpf: sale.customerCpf,
            customer_phone: sale.customerPhone,
            customer_email: sale.customerEmail,
            customer_reference: sale.customerReference,
            store_id: sale.storeId,
            seller_id: sale.sellerId,
            total: sale.total,
            status: sale.status,
            delivery_address: sale.deliveryAddress,
            delivery_obs: sale.deliveryObs,
            assembly_required: sale.assemblyRequired,
            assigned_driver_id: sale.assignedDriverId,
            assigned_assembler_id: sale.assignedAssemblerId
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
            location_id: item.locationId,
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

        return true;
    },

    async updateInventory(productId: string, locationId: string, quantity: number) {
        const { error } = await supabase
            .from('inventory')
            .upsert({ product_id: productId, location_id: locationId, quantity }, { onConflict: 'product_id,location_id' });

        if (error) throw error;
        return true;
    },

    async updateSaleStatus(saleId: string, status: string, extra?: any) {
        const payload: any = { status };
        if (extra?.deliverySignature) payload.delivery_signature = extra.deliverySignature;
        if (extra?.deliveryPhoto) payload.delivery_photo = extra.deliveryPhoto;
        if (extra?.assemblySignature) payload.assembly_signature = extra.assemblySignature;
        if (extra?.assemblyPhoto) payload.assembly_photo = extra.assemblyPhoto;

        if (status === 'Entregue') {
            payload.delivery_date = new Date().toISOString().split('T')[0];
        }

        const { error } = await supabase
            .from('sales')
            .update(payload)
            .eq('id', saleId);

        if (error) throw error;

        // Liberar pagamentos pendentes de entrega para o Acerto Caixa
        if (status === 'Entregue') {
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
            store_id: employee.storeId
        };
        const { error } = await supabase.from('employees').insert(payload);
        if (error) throw error;
        return true;
    },

    async updateEmployee(id: string, updates: Partial<Employee>) {
        const payload: any = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.username !== undefined) payload.username = updates.username;
        if (updates.password !== undefined) payload.password = updates.password;
        if (updates.role !== undefined) payload.role = updates.role;
        if (updates.active !== undefined) payload.active = updates.active;
        if (updates.storeId !== undefined) payload.store_id = updates.storeId;

        const { error } = await supabase.from('employees').update(payload).eq('id', id);
        if (error) throw error;
        return true;
    },

    async createStore(store: Store) {
        const payload: Record<string, any> = { id: store.id, name: store.name, type: store.type };
        const { error } = await supabase.from('stores').insert(payload);
        if (error) throw error;
        return true;
    },

    async updateStore(id: string, updates: Partial<Store>) {
        const payload: Record<string, any> = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.type !== undefined) payload.type = updates.type;

        const { error } = await supabase.from('stores').update(payload).eq('id', id);
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
            .in('status', ['PENDENTE_ENTREGA', 'AGUARDANDO_ACERTO']);

        if (error) throw error;
        return true;
    },

    // AUTH
    async signIn(email: string, pass: string) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: pass
        });
        if (error) throw error;
        return data.user;
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
        if (updates.zipCode !== undefined) {
            payload.zip_code = updates.zipCode;
            delete payload.zipCode;
        }
        const { error } = await supabase.from('customers').update(payload).eq('id', id);
        if (error) throw error;
        return true;
    }
};
