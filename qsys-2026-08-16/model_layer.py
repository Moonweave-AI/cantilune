import numpy as np
import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX
from hmmlearn.hmm import GaussianHMM

class MacroPolicyModel:
    def __init__(self):
        # Policy risk model parameters
        self.bert_dim = 768
        self.lstm_units = 128
        
        # Macro shock detection parameters
        self.hmm_states = 4
        self.lookback = 252  # One year of daily data

    def build_policy_risk_model(self):
        """BERT-LSTM混合模型用于政策文本情感分析"""
        from tensorflow.keras.models import Sequential
        from tensorflow.keras.layers import LSTM, Dense, Dropout
        
        model = Sequential([
            Dense(512, activation='relu', input_shape=(self.bert_dim,)),
            Dropout(0.3),
            LSTM(self.lstm_units, return_sequences=True),
            LSTM(self.lstm_units),
            Dense(1, activation='sigmoid')  # Binary classification (risk/no risk)
        ])
        model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
        return model

    def train_policy_model(self, X_train, y_train):
        model = self.build_policy_risk_model()
        model.fit(X_train, y_train, epochs=10, batch_size=32, validation_split=0.2)
        return model

    def detect_macro_shocks(self, market_data):
        """基于HMM的宏观冲击检测模型"""
        # Prepare features
        features = market_data[['policy_risk_score', 'volatility', 'yield_curve_slope']].values
        
        # Train HMM
        hmm = GaussianHMM(n_components=self.hmm_states, covariance_type="diag", n_iter=50)
        hmm.fit(features)
        
        # Predict hidden states
        hidden_states = hmm.predict(features)
        return hidden_states, hmm

    def calculate_risk_premium(self, hidden_states, hmm, current_features):
        """计算当前宏观风险溢价"""
        # Get transition probabilities
        trans_probs = hmm.transmat_
        curr_state = hidden_states[-1]
        
        # Predict next state probabilities
        next_state_probs = trans_probs[curr_state]
        
        # Calculate risk premium based on state transitions
        risk_premium = np.dot(next_state_probs, hmm.means_.flatten())
        return risk_premium