import { Match, Switch } from "solid-js";
import { Order } from "../../declarations/demo_backend/demo_backend.did";
import { tokensToStr } from "@fort-major/msq-shared";
import { BuyBtn } from "../plushie-card/style";
import {
  OrderFooter,
  OrderFooterTotal,
  OrderItems,
  OrderItemsImg,
  OrderItemsText,
  OrderItemsTextName,
  OrderItemsTextQty,
  OrderStatus,
  OrderWrapper,
} from "./style";

export function OrderComp(props: Order & { onPay(): void; loading: boolean; plushiePriceUsd: bigint }) {
  return (
    <OrderWrapper>
      <OrderItems>
        <OrderItemsImg src="https://m.media-amazon.com/images/I/81dNGvKezHL._AC_SX679_.jpg" />
        <OrderItemsText>
          <OrderItemsTextName>Plushie Pink Unicorn</OrderItemsTextName>
          <OrderItemsTextQty>x{props.number_of_plushies}</OrderItemsTextQty>
        </OrderItemsText>
      </OrderItems>
      <OrderFooter>
        <OrderFooterTotal>
          <span>$</span>
          {tokensToStr(BigInt(props.number_of_plushies) * props.plushiePriceUsd, 8)}
        </OrderFooterTotal>
        <Switch>
          <Match when={"PendingPayment" in props.status}>
            <BuyBtn disabled={props.loading} onClick={props.onPay}>
              Pay
            </BuyBtn>
          </Match>
          <Match when={"Paid" in props.status}>
            <OrderStatus>Paid</OrderStatus>
          </Match>
        </Switch>
      </OrderFooter>
    </OrderWrapper>
  );
}
