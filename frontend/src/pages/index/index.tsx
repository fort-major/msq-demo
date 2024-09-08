import { HttpAgent, Identity } from "@dfinity/agent";
import { MsqClient } from "@fort-major/msq-client";
import { Match, Show, Switch, batch, createEffect, createResource, createSignal } from "solid-js";
import { Body, BodyHeading, Header, LoginButton, Logo, ProfileWrapper } from "./style";
import MetaMaskLogoSvg from "#assets/metamask.svg";
import { PlushieCard } from "../../components/plushie-card";
import { createBackendActor } from "../../backend";
import { Order } from "../../declarations/demo_backend/demo_backend.did";
import { OrderComp } from "../../components/order";
import { Principal } from "@dfinity/principal";

export const MSQ_ORIGIN = import.meta.env.MODE === "ic" ? "https://msq.tech" : "http://localhost:8000";
export const MSQ_SNAP_ID = import.meta.env.MODE === "ic" ? "npm:@fort-major/msq" : "local:http://localhost:8081";

interface IProfile {
  pseudonym: string;
  avatarSrc: string;
}

export const IndexPage = () => {
  const [qty, setQty] = createSignal(0);
  const [identity, setIdentity] = createSignal<Identity | null>(null);
  const [profile, setProfile] = createSignal<IProfile | null>(null);
  const [loading, setLoading] = createSignal<boolean>(false);
  const [order, setOrder] = createSignal<Order | null>(null);
  const [msq, setMsq] = createSignal<MsqClient>();

  const [backend] = createResource(identity, async (identity) => {
    const agent = new HttpAgent({
      identity,
      host: import.meta.env.VITE_IC_HOST,
    });

    if (import.meta.env.MODE === "dev") {
      await agent.fetchRootKey();
    }

    return createBackendActor(agent);
  });

  const [orders] = createResource(backend, async (backend) => {
    const ids = await backend.get_my_order_ids();

    return Promise.all(ids.map(backend.get_order));
  });

  const [plushiePriceUsd] = createResource(backend, async (backend) => backend.get_plushie_price_usd());

  createEffect(async () => {
    if (MsqClient.isSafeToResume()) {
      handleLogin();
    }
  });

  const handleLogin = async () => {
    const result = await MsqClient.createAndLogin({ msqOrigin: MSQ_ORIGIN, snapId: MSQ_SNAP_ID });

    if ("Err" in result) {
      throw new Error(result.Err);
    }

    const { msq, identity } = result.Ok;

    const profile: IProfile = {
      pseudonym: await identity.getPseudonym(),
      avatarSrc: await identity.getAvatarSrc(),
    };

    batch(() => {
      setProfile(profile);
      setIdentity(identity);
      setMsq(msq);
    });
  };

  const handleAdd = () => {
    setQty((qty) => qty + 1);
  };

  const handleRemove = () => {
    setQty((qty) => qty - 1);
  };

  const handleContinue = async () => {
    setLoading(true);

    const orderId = await backend()!.create_order(qty());
    const order = await backend()!.get_order(orderId);

    setOrder(order);

    setLoading(false);
  };

  const handlePay = async () => {
    const o = order();
    if (!o) return;

    if (!("PendingPayment" in o.status)) return;

    setLoading(true);

    try {
      const resp = await msq()!.requestMSQPay(o.status.PendingPayment as Uint8Array);

      console.log(resp);

      if (resp === null) {
        setTimeout(() => {
          alert("The payment was rejected!");

          setLoading(false);
        }, 500);
        return;
      }

      await backend()!.complete_order(o.id, Principal.fromText(resp.tokenId), resp.blockIdx);

      const or = await backend()!.get_order(o.id);

      console.log(or);

      setOrder(or);

      setLoading(false);
    } catch (e) {
      setLoading(false);
      throw e;
    }
  };

  const handleLink = async () => {
    const links = await msq()!.getLinks();

    if (links.includes("https://3rhoj-baaaa-aaaak-afdua-cai.icp0.io")) return;

    await msq()!.requestLink("https://3rhoj-baaaa-aaaak-afdua-cai.icp0.io");
  };

  return (
    <>
      <Header>
        <Logo onClick={handleLink}>
          {location.host === "3rhoj-baaaa-aaaak-afdua-cai.icp0.io" ? "Improved " : ""} Plushie World
        </Logo>
        <Switch>
          <Match when={identity() === null}>
            <LoginButton onClick={handleLogin}>
              <span>Login with MetaMask</span>
              <img src={MetaMaskLogoSvg} />
            </LoginButton>
          </Match>
          <Match when={identity() !== null}>
            <ProfileWrapper>
              <img src={profile()!.avatarSrc} />
              <p>{profile()!.pseudonym}</p>
            </ProfileWrapper>
          </Match>
        </Switch>
      </Header>
      <Body>
        <Switch>
          <Match when={order() === null}>
            <BodyHeading>Support us by purchasing our Plushies!</BodyHeading>
            <PlushieCard
              loggedIn={identity() !== null}
              loading={backend() === undefined || loading()}
              qty={qty()}
              priceUsdE8s={plushiePriceUsd() ?? 0n}
              onAdd={handleAdd}
              onRemove={handleRemove}
              onContinue={handleContinue}
            />
          </Match>
          <Match when={order() !== null}>
            <BodyHeading>Here is your order</BodyHeading>
            <Show when={plushiePriceUsd()}>
              <OrderComp loading={loading()} {...order()!} onPay={handlePay} plushiePriceUsd={plushiePriceUsd()!} />
            </Show>
          </Match>
        </Switch>
      </Body>
    </>
  );
};
