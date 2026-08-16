import pandas as pd
import numpy as np
from transformers import BertTokenizer, TFBertModel
from kafka import KafkaConsumer

class MultiSourceDataPipeline:
    def __init__(self):
        self.tokenizer = BertTokenizer.from_pretrained('bert-base-uncased')
        self.bert_model = TFBertModel.from_pretrained('bert-base-uncased')
        self.consumer = KafkaConsumer(bootstrap_servers='localhost:9092')

    def policy_text_embedding(self, text):
        inputs = self.tokenizer(text, return_tensors='tf', max_length=512, truncation=True)
        outputs = self.bert_model(inputs)
        return outputs.last_hidden_state[:,0,:].numpy()[0]  # CLS token embedding

    def stream_data(self, topic='market_data'):
        self.consumer.subscribe([topic])
        for message in self.consumer:
            # Process raw market data
            raw_data = pd.read_json(message.value)
            # Extract features using TA-Lib
            features = self._extract_features(raw_data)
            # Convert policy text to embeddings
            policy_embedding = self.policy_text_embedding(raw_data['policy_text'].iloc[0])
            yield features, policy_embedding

    def _extract_features(self, data):
        # Implement TA-Lib technical indicators
        import talib
        data['sma_20'] = talib.SMA(data['close'], timeperiod=20)
        data['rsi_14'] = talib.RSI(data['close'], timeperiod=14)
        return data[['sma_20', 'rsi_14']].fillna(0)