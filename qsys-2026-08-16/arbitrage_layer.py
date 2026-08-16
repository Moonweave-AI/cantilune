import numpy as np
import pandas as pd
from scipy.stats import norm
from statsmodels.tsa.vector_ar.vecm import coint_johansen

class CrossMarketArbitrage:
    def __init__(self, assets=['SPX','Gold','Crude','KalshiPolicy']):
        self.assets = assets
        self.lookback = 60  # Minutes of historical data for cointegration
        
    def johansen_coint(self, data):
        """Johansen协整检验寻找跨市场价差关系"""
        # data shape: (T, N) where T=time, N=assets
        result = coint_johansen(data, det_order=0, k_ar_diff=1)
        eigen_values = result.lr1
        eigen_threshold = result.cvt[0]  # 95% confidence level
        
        # Find number of cointegrating vectors
        self.rank = sum(eigen_values > eigen_threshold)
        if self.rank == 0:
            return None  # No cointegration
        
        # Get eigenvectors for strongest cointegrating relationship
        eigenvector = result.evec[:, np.argmax(eigen_values)]
        return eigenvector / eigenvector[0]  # Normalize first asset

    def calculate_zscore(self, spread, window=30):
        """计算价差序列的Z-score"""
        mean = np.mean(spread[-window:])
        std = np.std(spread[-window:])
        return (spread[-1] - mean) / std

    def dynamic_hedging(self, positions, deltas):
        """Delta-Gamma中性对冲计算
        positions: 当前持仓数量
        deltas: 各资产Delta值（敞口敏感度）
        """
        # 计算Gamma矩阵（二阶导数）
        gamma_matrix = np.random.rand(len(deltas), len(deltas))  # 示例数据
        gamma_matrix = (gamma_matrix + gamma_matrix.T) / 2  # 对称化
        
        # 目标：最小化敞口 = positions.T @ deltas + 0.5 * positions.T @ gamma_matrix @ positions
        # 简化实现：仅Delta中性
        hedge_ratios = np.linalg.inv(gamma_matrix) @ deltas
        return hedge_ratios / hedge_ratios[0]  # 相对于第一个资产标准化