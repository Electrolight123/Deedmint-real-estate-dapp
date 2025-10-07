// src/App.js
import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';

// Components
import Navigation from './components/Navigation';
import Search from './components/Search';
import Home from './components/Home';

// ABIs
import RealEstate from './abis/RealEstate.json';
import Escrow from './abis/Escrow.json';

// Config
import config from './config.json';

function App() {
  const [provider, setProvider] = useState(null);
  const [escrow, setEscrow] = useState(null);

  const [account, setAccount] = useState(null);

  const [homes, setHomes] = useState([]);
  const [home, setHome] = useState({});
  const [toggle, setToggle] = useState(false);

  // helper: normalize ipfs://... URIs to https gateway
  const toHttpFromIpfs = (uri) => {
    if (!uri) return uri;
    if (uri.startsWith('ipfs://')) {
      return `https://ipfs.io/ipfs/${uri.slice('ipfs://'.length)}`;
    }
    return uri;
  };

  useEffect(() => {
    const load = async () => {
      try {
        if (!window.ethereum) {
          window.alert('MetaMask not detected. Please install MetaMask and refresh.');
          return;
        }

        const provider_ = new ethers.providers.Web3Provider(window.ethereum);
        setProvider(provider_);

        const network = await provider_.getNetwork();

        // Guard against wrong network (config only has 31337)
        if (!config[network.chainId]) {
          window.alert(`Unsupported network ${network.chainId}. Switch to Hardhat localhost (31337).`);
          return;
        }

        // Contracts
        const realEstate = new ethers.Contract(
          config[network.chainId].realEstate.address,
          RealEstate,
          provider_
        );

        const escrow_ = new ethers.Contract(
          config[network.chainId].escrow.address,
          Escrow,
          provider_
        );
        setEscrow(escrow_);

        // Read tokens
        const totalSupplyBN = await realEstate.totalSupply();
        const totalSupply = totalSupplyBN.toNumber();

        const homes_ = [];
        for (let i = 1; i <= totalSupply; i++) {
          try {
            let uri = await realEstate.tokenURI(i);
            uri = toHttpFromIpfs(uri);

            const res = await fetch(uri);
            if (!res.ok) {
              console.warn(`Failed to fetch metadata for token ${i}: ${res.status}`);
              continue;
            }
            const metadata = await res.json();
            homes_.push(metadata);
          } catch (innerErr) {
            console.warn(`Error loading token ${i}:`, innerErr);
          }
        }
        setHomes(homes_);

        // listeners
        const handleAccountsChanged = (accounts) => {
          setAccount(accounts && accounts[0] ? ethers.utils.getAddress(accounts[0]) : null);
        };

        const handleChainChanged = () => {
          // reload the page to re-init providers/contracts on network change
          window.location.reload();
        };

        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        // cleanup
        return () => {
          if (window.ethereum && window.ethereum.removeListener) {
            window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            window.ethereum.removeListener('chainChanged', handleChainChanged);
          }
        };
      } catch (err) {
        console.error('load error:', err);
        window.alert('Failed to initialize dApp. Check console for details.');
      }
    };

    load();
  }, []); // run once

  const togglePop = (home_) => {
    setHome(home_)
    toggle ? setToggle(false) : setToggle(true);
  };

  return (
    <div>
      <Navigation account={account} setAccount={setAccount} />
      <Search />

      <div className="cards__section">
        <h3>Homes For You</h3>
        <hr />

        <div className="cards">
          {homes.map((h, index) => (
            <div className="card" key={index} onClick={() => togglePop(h)}>
              <div className="card__image">
                <img src={h.image} alt="Home" />
              </div>
              <div className="card__info">
                <h4>{h?.attributes?.[0]?.value} ETH</h4>
                <p>
                  <strong>{h?.attributes?.[2]?.value}</strong> bds |{' '}
                  <strong>{h?.attributes?.[3]?.value}</strong> ba |{' '}
                  <strong>{h?.attributes?.[4]?.value}</strong> sqft
                </p>
                <p>{h.address}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {toggle && (
        <Home
          home={home}
          provider={provider}
          account={account}
          escrow={escrow}
          togglePop={togglePop}
        />
      )}
    </div>
  );
}

export default App;
