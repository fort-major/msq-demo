use candid::{CandidType, Nat, Principal};
use ic_cdk::{
    caller, export_candid, init, post_upgrade, pre_upgrade, query,
    storage::{stable_restore, stable_save},
    update,
};
use msq_pay_types::{InterCanisterClient, Invoice, InvoiceId};
use serde::Deserialize;
use std::{
    cell::RefCell,
    collections::{btree_map::Entry, BTreeMap, BTreeSet},
};

mod env;

#[update]
async fn create_order(number_of_plushies: u32) -> OrderId {
    let (shop_id, qty_usd_e8s) = STATE.with_borrow(|s| {
        (
            s.msq_pay_shop_id,
            s.price_usd_e8s.clone() * Nat::from(number_of_plushies),
        )
    });

    let msq_pay_client = InterCanisterClient::new(Some(
        Principal::from_text("prlga-2iaaa-aaaak-akp4a-cai").unwrap(),
    ));
    let invoice_id = msq_pay_client
        .create_invoice(shop_id, qty_usd_e8s)
        .await
        .expect("Unable to create an invoice");

    STATE.with_borrow_mut(|s| {
        let order_id = s.order_id_counter.clone();
        s.order_id_counter += Nat::from(1u64);

        let order = Order {
            id: order_id.clone(),
            number_of_plushies,
            status: OrderStatus::PendingPayment(invoice_id),
            buyer: caller(),
        };

        s.orders.insert(order_id.clone(), order);

        match s.orders_by_owner.entry(caller()) {
            Entry::Vacant(e) => {
                let mut set = BTreeSet::new();
                set.insert(order_id.clone());

                e.insert(set);
            }
            Entry::Occupied(mut e) => {
                e.get_mut().insert(order_id.clone());
            }
        }

        order_id
    })
}

#[update]
async fn complete_order(order_id: OrderId, token_id: Principal, block_idx: Nat) {
    let invoice_id = STATE.with_borrow(|s| {
        let order = s.orders.get(&order_id).expect("Order not found");
        match order.status {
            OrderStatus::PendingPayment(invoice_id) => invoice_id,
            _ => panic!("Invalid order status"),
        }
    });

    let msq_pay_client = InterCanisterClient::new(Some(
        Principal::from_text("prlga-2iaaa-aaaak-akp4a-cai").unwrap(),
    ));
    let payment_result = msq_pay_client
        .verify_payment(invoice_id, token_id, block_idx)
        .await;

    STATE.with_borrow_mut(|s| {
        // make sure you handle possible race condition properly here
        let order = s.orders.get_mut(&order_id).unwrap();

        match payment_result {
            // if all good - transition the order to the next stage (e.g. "In Delivery")
            Ok(invoice) => order.status = OrderStatus::Paid(invoice),
            Err(reason) => order.status = OrderStatus::Failed(reason),
        }
    });
}

#[query]
fn get_plushie_price_usd() -> Nat {
    STATE.with_borrow(|s| s.price_usd_e8s.clone())
}

#[query]
fn get_order(order_id: OrderId) -> Order {
    STATE.with_borrow(|it| it.orders.get(&order_id).cloned().unwrap())
}

#[query]
fn get_my_order_ids() -> BTreeSet<OrderId> {
    STATE.with_borrow(|it| {
        it.orders_by_owner
            .get(&caller())
            .cloned()
            .unwrap_or_default()
    })
}

#[derive(CandidType, Deserialize, Default)]
struct State {
    msq_pay_shop_id: u64,
    price_usd_e8s: Nat,
    order_id_counter: OrderId,
    orders: BTreeMap<OrderId, Order>,
    orders_by_owner: BTreeMap<Principal, BTreeSet<OrderId>>,
}

type OrderId = Nat;

#[derive(Clone, CandidType, Deserialize)]
struct Order {
    id: OrderId,
    number_of_plushies: u32,
    status: OrderStatus,
    buyer: Principal,
}

#[derive(Clone, CandidType, Deserialize)]
pub enum OrderStatus {
    PendingPayment(InvoiceId),
    Paid(Invoice),
    Failed(String),
}

thread_local! {
    static STATE: RefCell<State> = RefCell::default();
}

#[derive(CandidType, Deserialize)]
pub struct InitArgs {
    pub msq_pay_shop_id: u64,
    pub price_usd_e8s: Nat,
}

#[init]
fn init_hook(args: InitArgs) {
    STATE.with_borrow_mut(|s| {
        s.price_usd_e8s = args.price_usd_e8s;
        s.msq_pay_shop_id = args.msq_pay_shop_id;
    });
}

#[pre_upgrade]
fn pre_upgrade_hook() {
    STATE.with_borrow(|s| stable_save((s,)).expect("Unable to save to stable memory"));
}

#[post_upgrade]
fn post_upgrade_hook() {
    STATE.with_borrow_mut(|s| {
        *s = stable_restore::<(State,)>()
            .expect("Unable to restore from stable memory")
            .0
    });
}

export_candid!();
