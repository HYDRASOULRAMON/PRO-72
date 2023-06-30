import React, { Component } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
  ImageBackground,
  Image,
  Alert,
  ToastAndroid,
  KeyboardAvoidingView,
} from 'react-native';
import * as Permissions from 'expo-permissions';
import { BarCodeScanner } from 'expo-barcode-scanner';
import firebase from 'firebase';
import db from '../config';

const bgImage = require('../assets/background2.png');
const appIcon = require('../assets/appIcon.png');

export default class RideScreen extends Component {
  constructor(props) {
    super(props);
    this.state = {
      bikeId: '',
      userId: '',
      domState: 'normal',
      hasCameraPermissions: null,
      scanned: false,
      bikeType: '',
      userName: '',
      bikeAssigned: '',
    };
  }

  getCameraPermissions = async () => {
    const { status } = await Permissions.askAsync(Permissions.CAMERA);

    this.setState({
      hasCameraPermissions: status === 'granted',
      domState: 'scanner',
      scanned: false,
    });
  };

  handleBarCodeScanned = ({ type, data }) => {
    this.setState({
      bikeId: data,
      domState: 'normal',
      scanned: true,
    });
  };

  handleTransaction = async () => {
    const { bikeId, userId } = this.state;
    await this.getBikeDetails(bikeId);
    await this.getUserDetails(userId);

    db.collection('bicycles')
      .doc(bikeId)
      .get()
      .then((doc) => {
        const bike = doc.data();
        if (bike.is_bike_available) {
          const { bikeType, userName } = this.state;

          this.assignBike(bikeId, userId, bikeType, userName);

          // For Android users only
          ToastAndroid.show(
            'You have rented the bike for the next 1 hour. Enjoy your ride!!',
            ToastAndroid.SHORT
          );

          this.setState({
            bikeAssigned: true,
          });
        } else {
          const { bikeType, userName } = this.state;

          this.returnBike(bikeId, userId, bikeType, userName);

          // For Android users only
          ToastAndroid.show('We hope you enjoyed your ride', ToastAndroid.SHORT);

          this.setState({
            bikeAssigned: false,
          });
        }
      });
  };

  getBikeDetails = (bikeId) => {
    bikeId = bikeId.trim();
    db.collection('bicycles')
      .where('id', '==', bikeId)
      .get()
      .then((snapshot) => {
        snapshot.docs.map((doc) => {
          this.setState({
            bikeType: doc.data().bike_type,
          });
        });
      });
  };

  getUserDetails = (userId) => {
    db.collection('users')
      .where('id', '==', userId)
      .get()
      .then((snapshot) => {
        snapshot.docs.map((doc) => {
          this.setState({
            userName: doc.data().name,
            userId: doc.data().id,
            bikeAssigned: doc.data().bike_assigned,
          });
        });
      });
  };

  assignBike = async (bikeId, userId, bikeType, userName) => {
    // Add a transaction
    db.collection('transactions').add({
      user_id: userId,
      user_name: userName,
      bike_id: bikeId,
      bike_type: bikeType,
      date: firebase.firestore.Timestamp.now().toDate(),
      transaction_type: 'rent',
    });

    // Update bike status
    db.collection('bicycles').doc(bikeId).update({
      is_bike_available: false,
    });

    // Update user's bike_assigned status
    db.collection('users').doc(userId).update({
      bike_assigned: true,
    });
  };

  returnBike = async (bikeId, userId, bikeType, userName) => {
    // Add a transaction
    db.collection('transactions').add({
      user_id: userId,
      user_name: userName,
      bike_id: bikeId,
      bike_type: bikeType,
      date: firebase.firestore.Timestamp.now().toDate(),
      transaction_type: 'return',
    });

    // Update bike status
    db.collection('bicycles').doc(bikeId).update({
      is_bike_available: true,
    });

    // Update user's bike_assigned status
    db.collection('users').doc(userId).update({
      bike_assigned: false,
    });
  };

  render() {
    const { hasCameraPermissions, scanned, domState } = this.state;

    if (domState === 'normal') {
      return (
        <ImageBackground source={bgImage} style={styles.backgroundImage}>
          <View style={styles.appIconContainer}>
            <Image source={appIcon} style={styles.appIcon} />
            <Text style={styles.appTitle}>Bike Rental App</Text>
          </View>
          <View style={styles.formContainer}>
            <TextInput
              style={styles.inputBox}
              placeholder="Enter User ID"
              onChangeText={(text) => {
                this.setState({
                  userId: text,
                });
              }}
              value={this.state.userId}
            />
            <TouchableOpacity
              style={styles.scanButton}
              onPress={this.getCameraPermissions}
            >
              <Text style={styles.buttonText}>Scan Bike QR Code</Text>
            </TouchableOpacity>
          </View>
        </ImageBackground>
      );
    } else if (domState === 'scanner') {
      return (
        <View style={styles.container}>
          <BarCodeScanner
            onBarCodeScanned={scanned ? undefined : this.handleBarCodeScanned}
            style={StyleSheet.absoluteFillObject}
          />
          {scanned && (
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() =>
                this.setState({
                  scanned: false,
                })
              }
            >
              <Text style={styles.buttonText}>Tap to Scan Again</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.transactionButton}
            onPress={this.handleTransaction}
          >
            <Text style={styles.buttonText}>Unlock / End Ride</Text>
          </TouchableOpacity>
        </View>
      );
    }
  }
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    resizeMode: 'cover',
    justifyContent: 'center',
  },
  appIconContainer: {
    flex: 0.3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appIcon: {
    width: 150,
    height: 150,
  },
  appTitle: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
  },
  formContainer: {
    flex: 0.7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputBox: {
    width: '80%',
    height: 40,
    borderWidth: 1.5,
    borderColor: '#fff',
    borderRadius: 10,
    fontSize: 20,
    padding: 10,
    margin: 20,
    color: '#fff',
  },
  scanButton: {
    backgroundColor: '#0A7FC1',
    padding: 15,
    margin: 10,
    borderRadius: 10,
  },
  transactionButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    margin: 10,
    borderRadius: 10,
  },
  buttonText: {
    fontSize: 20,
    color: '#fff',
    textAlign: 'center',
  },
});
