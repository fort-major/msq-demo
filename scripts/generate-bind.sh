#!/usr/bin/env bash

rm -rf ./frontend/src/declarations && \
dfx generate demo_backend && \
mv ./src/declarations ./frontend/src/declarations && \
rm ./frontend/src/declarations/demo_backend/demo_backend.did && \
rm -rf ./src
