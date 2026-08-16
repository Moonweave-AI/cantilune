import time
import pandas as pd
from data_pipeline import MultiSourceDataPipeline
from model_layer import MacroPolicyModel
from arbitrage_layer import CrossMarketArbitrage
from execution_engine import LowLatencyExecution

class QuantSystem:
    def __init__(self):
        # 初始化各组件
        self.data_pipeline = MultiSourceDataPipeline()
        self.policy_model = MacroPolicyModel()
        self.arbitrage_engine = CrossMarketArbitrage()
        self.execution_engine = LowLatencyExecution()
        
        # 系统状态
        self.historical_data = []
        self.positions = {asset: 0 for asset in ['SPX','XAUUSD','CL','KALSHI']}
        self.market_data = {}
        
    def system_warmup(self, warmup_days=7):
        """系统预热：加载历史数据并初始化模型"""
        print("[SYSTEM] Initializing Quant System...")
        
        # 模拟历史数据加载（实际应从数据库获取）
        for _ in range(warmup_days*24*60):  # 假设分钟级数据
            features, policy_embedding = next(self.data_pipeline.stream_data())
            self.historical_data.append(features)
            
        # 合并历史数据
        self.historical_df = pd.concat(self.historical_data)
        
        # 训练政策风险模型（示例）
        X_train = np.random.rand(100, 768)  # 示例数据
        y_train = np.random.randint(0, 2, 100)  # 示例标签
        self.policy_model.train_policy_model(X_train, y_train)
        
        print("[SYSTEM] System Ready!")
        
    def real_time_loop(self):
        """实时交易循环"""
        while True:
            # 1. 获取实时数据
            features, policy_embedding = next(self.data_pipeline.stream_data())
            self.market_data.update({
                'SPX': {'price': features['close'].iloc[-1], 'volatility': features['rsi_14'].iloc[-1]/100},
                'XAUUSD': {'price': features['close'].iloc[-1], 'volatility': features['rsi_14'].iloc[-1]/100}
            })
            
            # 2. 检测宏观冲击
            hidden_states, hmm = self.policy_model.detect_macro_shocks(
                pd.DataFrame([{
                    'policy_risk_score': policy_embedding[0],
                    'volatility': features['rsi_14'].iloc[-1]/100,
                    'yield_curve_slope': 0.5  # 示例数据
                }])
            )
            
            # 3. 检测跨市场价差
            if len(self.historical_df) > 100:
                sample_data = self.historical_df[-100:][['sma_20', 'rsi_14']]
                eigenvector = self.arbitrage_engine.johansen_coint(sample_data)
                if eigenvector is not None:
                    spread = np.dot(sample_data, eigenvector)
                    zscore = self.arbitrage_engine.calculate_zscore(spread)
                    
                    # 4. 生成交易信号
                    if abs(zscore) > 2:
                        signal = self.generate_signal(eigenvector, zscore)
                        # 5. 执行交易
                        executed = self.execution_engine.execute_order(self.execution_engine.order_book, signal)
                        # 6. 更新持仓
                        self.update_positions(executed)
                        # 7. 风险控制
                        risk = self.execution_engine.risk_control(self.positions, self.market_data)
                        print(f"[TRADE] Signal: {signal}, Executed: {executed}, Risk: ${risk:,.2f}")
            
            # 8. 系统心跳
            self.system_heartbeat()
            time.sleep(60)  # 每分钟执行一次

    def generate_signal(self, eigenvector, zscore):
        """根据协整关系生成交易信号"""
        signal = {}
        threshold = 2.0
        
        if zscore > threshold:  # 做空价差
            signal['SPX'] = {'action': 'sell', 'quantity': 1, 'price': self.market_data['SPX']['price']}
            signal['XAUUSD'] = {'action': 'buy', 'quantity': 1, 'price': self.market_data['XAUUSD']['price']}
        elif zscore < -threshold:  # 做多价差
            signal['SPX'] = {'action': 'buy', 'quantity': 1, 'price': self.market_data['SPX']['price']}
            signal['XAUUSD'] = {'action': 'sell', 'quantity': 1, 'price': self.market_data['XAUUSD']['price']}
        return signal

    def update_positions(self, executed):
        """更新持仓信息"""
        for symbol in executed:
            qty = executed[symbol]['executed_qty']
            if executed[symbol]['action'] == 'buy':
                self.positions[symbol] += qty
            else:
                self.positions[symbol] -= qty

    def system_heartbeat(self):
        """系统心跳信号"""
        print(f"[HEARTBEAT] Current Positions: {self.positions}")
        print(f"[HEARTBEAT] Market Data: {self.market_data}")

if __name__ == "__main__":
    # 初始化交易系统
    qsys = QuantSystem()
    # 预热系统
    qsys.system_warmup(warmup_days=3)
    # 启动实时交易循环
    qsys.real_time_loop()