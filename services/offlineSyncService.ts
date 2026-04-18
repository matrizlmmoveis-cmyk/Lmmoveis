
import { supabaseService } from './supabaseService';
import { OrderStatus } from '../types';

interface SyncAction {
    id: string;
    type: 'UPDATE_STATUS';
    saleId: string;
    status: string;
    extra?: any;
    timestamp: number;
}

const SYNC_QUEUE_KEY = 'lm_offline_sync_queue';
const SALES_CACHE_KEY = 'lm_cache_sales';

class OfflineSyncService {
    private isOnline: boolean = navigator.onLine;
    private isProcessing: boolean = false;

    constructor() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.processQueue();
        });
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
        
        // Tentar processar a fila ao iniciar
        setTimeout(() => this.processQueue(), 5000);
    }

    // --- CACHE DE DADOS ---
    saveSalesCache(sales: any[]) {
        try {
            localStorage.setItem(SALES_CACHE_KEY, JSON.stringify({
                data: sales,
                ts: Date.now()
            }));
        } catch (e) {
            console.warn("Falha ao salvar cache de vendas (quota excedida?)", e);
        }
    }

    getSalesCache(): any[] | null {
        try {
            const raw = localStorage.getItem(SALES_CACHE_KEY);
            if (!raw) return null;
            return JSON.parse(raw).data;
        } catch {
            return null;
        }
    }

    // --- FILA DE SINCRONIZAÇÃO ---
    private getQueue(): SyncAction[] {
        try {
            const raw = localStorage.getItem(SYNC_QUEUE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    private saveQueue(queue: SyncAction[]) {
        try {
            localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
        } catch (e) {
            console.error("Erro crítico: Fila de sincronização cheia!", e);
        }
    }

    getPendingCount(): number {
        return this.getQueue().length;
    }

    async enqueueStatusUpdate(saleId: string, status: string, extra?: any): Promise<boolean> {
        const action: SyncAction = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'UPDATE_STATUS',
            saleId,
            status,
            extra,
            timestamp: Date.now()
        };

        const queue = this.getQueue();
        queue.push(action);
        this.saveQueue(queue);

        // Se estiver online, tenta processar imediatamente
        if (this.isOnline) {
            this.processQueue();
        }

        return true;
    }

    private async processQueue() {
        if (this.isProcessing || !this.isOnline) return;
        
        const queue = this.getQueue();
        if (queue.length === 0) return;

        this.isProcessing = true;
        console.log(`[OfflineSync] Processando fila: ${queue.length} ações pendentes.`);

        const remainingQueue: SyncAction[] = [...queue];

        for (const action of queue) {
            try {
                if (action.type === 'UPDATE_STATUS') {
                    await supabaseService.updateSaleStatus(action.saleId, action.status, action.extra);
                    await supabaseService.syncRomaneioStatus(action.saleId);
                }
                
                // Remover da fila após sucesso
                const index = remainingQueue.findIndex(a => a.id === action.id);
                if (index > -1) remainingQueue.splice(index, 1);
                this.saveQueue(remainingQueue);
                
                console.log(`[OfflineSync] Sucesso: Ação ${action.type} para ${action.saleId}`);
            } catch (err) {
                console.error(`[OfflineSync] Falha ao sincronizar ação ${action.id}:`, err);
                // Interrompe o processamento para não bagunçar a ordem ou saturar a rede
                break;
            }
        }

        this.isProcessing = false;
        
        // Emitir evento para as telas atualizarem
        window.dispatchEvent(new CustomEvent('lm_sync_completed'));
    }

    getOnlineStatus() {
        return this.isOnline;
    }
}

export const offlineSyncService = new OfflineSyncService();
