import { Match, Show, Switch } from "solid-js";
import {
  BuyBtn,
  CardControls,
  CardControlsInStock,
  CardControlsLeft,
  CardControlsPrice,
  CardControlsRight,
  CardDescription,
  CardHeader,
  CardImg,
  LogInError,
  PayBtn,
  PlushieCardWrapper,
  QtySelector,
} from "./style";
import { tokensToStr } from "@fort-major/msq-shared";

export interface IPlushieCardProps {
  priceUsdE8s: bigint;
  qty: number;
  onAdd(): void;
  onRemove(): void;

  loggedIn: boolean;
  loading: boolean;

  onContinue(): void;
}

export function PlushieCard(props: IPlushieCardProps) {
  return (
    <PlushieCardWrapper>
      <CardImg src="https://m.media-amazon.com/images/I/81dNGvKezHL._AC_SX679_.jpg" />
      <CardHeader>Plushie Pink Unicorn</CardHeader>
      <CardDescription>This unicorn can become a great gift for someone you care about!</CardDescription>
      <CardControls>
        <CardControlsLeft>
          <CardControlsPrice>
            <span>$</span>
            <Show when={props.qty > 0} fallback={tokensToStr(props.priceUsdE8s, 8)}>
              {tokensToStr(props.priceUsdE8s * BigInt(props.qty), 8)}
            </Show>{" "}
          </CardControlsPrice>
        </CardControlsLeft>
        <CardControlsRight>
          <Switch>
            <Match when={props.qty === 0}>
              <BuyBtn onClick={props.onAdd}>Add To Cart</BuyBtn>
            </Match>
            <Match when={props.qty > 0}>
              <QtySelector>
                <span onClick={props.onRemove}>-</span>
                <p>{props.qty}</p>
                <span onClick={props.onAdd}>+</span>
              </QtySelector>
            </Match>
          </Switch>
        </CardControlsRight>
      </CardControls>
      <Show when={props.qty > 0}>
        <Show when={props.loggedIn} fallback={<LogInError>Login to continue</LogInError>}>
          <Show when={!props.loading} fallback={<LogInError>Loading...</LogInError>}>
            <PayBtn onClick={props.onContinue}>Continue</PayBtn>
          </Show>
        </Show>
      </Show>
    </PlushieCardWrapper>
  );
}
